import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Maintenance, MaintenanceDocument, MaintenanceStatus } from '../maintenances/schemas/maintenance.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntry, FinancialEntryCategory, FinancialEntryDocument, FinancialEntryType } from '../financial-entries/schemas/financial-entry.schema';
import { Vehicle, VehicleDocument } from '../vehicles/schemas/vehicle.schema';
import { Mileage, MileageDocument } from '../mileage/schemas/mileage.schema';
import { Rental, RentalDocument, RentalStatus } from '../rentals/schemas/rental.schema';
import { DriversService } from '../drivers/drivers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RentalsService } from '../rentals/rentals.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Mileage.name) private mileageModel: Model<MileageDocument>,
    @InjectModel(FinancialEntry.name) private financialEntryModel: Model<FinancialEntryDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    private driversService: DriversService,
    private vehiclesService: VehiclesService,
    private rentalsService: RentalsService,
    private financialEntriesService: FinancialEntriesService,
  ) {}

  async getDashboardKpis(): Promise<any> {
    const [
      vehicleStats,
      driverStats,
      financialSummary,
    ] = await Promise.all([
      this.vehiclesService.countByStatus(),
      this.driversService.countByStatus(),
      this.rentalsService.getFinancialSummary(),
    ]);

    const maintenancePending = await this.maintenanceModel.countDocuments({
      status: MaintenanceStatus.SCHEDULED,
    });

    return {
      vehicles: {
        total: Object.values(vehicleStats).reduce((a: number, b: number) => a + b, 0),
        available: vehicleStats['AVAILABLE'] ?? 0,
        rented: vehicleStats['RENTED'] ?? 0,
        maintenance: vehicleStats['MAINTENANCE'] ?? 0,
        inactive: vehicleStats['INACTIVE'] ?? 0,
      },
      drivers: {
        total: Object.values(driverStats).reduce((a: number, b: number) => a + b, 0),
        active: driverStats['ACTIVE'] ?? 0,
        inactive: driverStats['INACTIVE'] ?? 0,
        suspended: driverStats['SUSPENDED'] ?? 0,
      },
      financial: financialSummary,
      maintenancePending,
    };
  }

  async getMonthlyRevenue(months = 6): Promise<any[]> {
    const result = await this.rentalsService['rentalModel']?.aggregate?.([
      { $unwind: '$payments' },
      { $match: { 'payments.status': 'PAID' } },
      {
        $group: {
          _id: {
            year: { $year: '$payments.paidAt' },
            month: { $month: '$payments.paidAt' },
          },
          total: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: months },
    ]) ?? [];

    return result;
  }

  async getFinancialPerVehicle(): Promise<any[]> {
    const vehicles = await this.vehiclesService['vehicleModel']
      .find()
      .select('_id licensePlate brand model currentDriverId')
      .populate('currentDriverId', 'name')
      .lean();
    
    const results = await Promise.all(vehicles.map(async (v) => {
      const ledger = await this.financialEntriesService.getVehicleLedger(v._id.toString());

      const revenue = ledger.totalIncome;
      const expense = ledger.totalExpense;

      // Extract specific costs if needed, but for now we can just show total expense as maintenanceCost + others
      // or we can separate them by category if required by the frontend.
      // The frontend currently expects: revenue, maintenanceCost, finesCost, profit
      const maintenanceCost = ledger.entries
        .filter(e => e.category === FinancialEntryCategory.MANUTENCAO)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const finesCost = ledger.entries
        .filter(e => e.category === FinancialEntryCategory.MULTA)
        .reduce((sum, e) => sum + e.amount, 0);

      const insurancesCost = ledger.entries
        .filter(e => e.category === FinancialEntryCategory.SEGURO)
        .reduce((sum, e) => sum + e.amount, 0);

      const fuelCost = ledger.entries
        .filter(e => e.category === FinancialEntryCategory.COMBUSTIVEL)
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        vehicleId: v._id,
        licensePlate: v.licensePlate,
        name: `${v.brand} ${v.model}`,
        driverName: (v.currentDriverId as any)?.name || null,
        revenue,
        maintenanceCost,
        finesCost,
        insurancesCost, 
        fuelCost,
        expense, 
        profit: ledger.balance
      };
    }));

    return results.sort((a, b) => b.profit - a.profit);
  }

  /**
   * Leituras de hodômetro por veículo, juntando as duas origens: a tela de Quilometragem /
   * abastecimentos (coleção mileages) e o reporte semanal do motorista no aluguel
   * (rentals.mileageLogs). Ordenadas por data.
   */
  async collectReadings(until: Date): Promise<Map<string, { date: Date; mileage: number }[]>> {
    const [docs, logs] = await Promise.all([
      this.mileageModel.find({ date: { $lte: until } }).select('vehicleId date mileage').lean(),
      this.rentalModel.aggregate([
        { $unwind: '$mileageLogs' },
        { $match: { 'mileageLogs.date': { $lte: until } } },
        { $project: { vehicleId: 1, date: '$mileageLogs.date', mileage: '$mileageLogs.newMileage' } },
      ]),
    ]);
    const by = new Map<string, { date: Date; mileage: number }[]>();
    for (const r of [...docs, ...logs] as any[]) {
      const key = String(r.vehicleId);
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push({ date: new Date(r.date), mileage: Number(r.mileage) || 0 });
    }
    for (const list of by.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return by;
  }

  /** Km rodados entre start e end a partir das leituras (hodômetro só cresce). */
  static kmBetween(readings: { date: Date; mileage: number }[] = [], start: Date, end: Date) {
    const before = readings.filter((r) => r.date <= start).map((r) => r.mileage);
    const inside = readings.filter((r) => r.date > start && r.date <= end).map((r) => r.mileage);
    if (!inside.length) return { km: 0, readings: 0, last: before.length ? Math.max(...before) : null };
    const base = before.length ? Math.max(...before) : Math.min(...inside);
    const last = Math.max(...inside);
    return { km: Math.max(0, last - base), readings: inside.length, last };
  }

  /**
   * Rodagem e custo por km (plano Pro): quanto cada veículo rodou no período, média por
   * semana comparada ao limite semanal do contrato, km excedente e quanto custou/rendeu
   * cada km. Combustível fica fora do custo — nas locadoras para app é do motorista.
   */
  async getMileagePerVehicle(days = 90): Promise<any> {
    const DAY = 24 * 60 * 60 * 1000;
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY);
    const weeks = days / 7;

    const [vehicles, readingsBy, money, rentals] = await Promise.all([
      this.vehicleModel.find().select('_id licensePlate brand model mileage').lean(),
      this.collectReadings(end),
      this.financialEntryModel.aggregate([
        {
          $match: {
            date: { $gt: start, $lte: end },
            vehicleId: { $ne: null },
            category: { $ne: FinancialEntryCategory.COMBUSTIVEL },
          },
        },
        { $group: { _id: { vehicleId: '$vehicleId', type: '$type' }, total: { $sum: '$amount' } } },
      ]),
      this.rentalModel
        .find({ status: { $in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] } })
        .select('vehicleId driverId startDate weeklyKmLimit excessKmFee mileageLogs')
        .populate('driverId', 'name')
        .lean(),
    ]);

    const moneyBy = new Map<string, { income: number; expenses: number }>();
    for (const m of money as any[]) {
      const key = String(m._id.vehicleId);
      const cur = moneyBy.get(key) ?? { income: 0, expenses: 0 };
      if (m._id.type === FinancialEntryType.INCOME) cur.income += m.total;
      else cur.expenses += m.total;
      moneyBy.set(key, cur);
    }
    const rentalBy = new Map((rentals as any[]).map((r) => [String(r.vehicleId), r]));

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const perKm = (value: number, km: number) => (km > 0 ? round2(value / km) : null);

    const rows = vehicles.map((v: any) => {
      const readings = readingsBy.get(String(v._id)) ?? [];
      const { km, readings: n } = ReportsService.kmBetween(readings, start, end);
      const lastReading = readings[readings.length - 1];
      const { income, expenses } = moneyBy.get(String(v._id)) ?? { income: 0, expenses: 0 };
      const rental: any = rentalBy.get(String(v._id));
      const limit: number | null = rental?.weeklyKmLimit || null;
      const kmPerWeek = round2(km / weeks);

      // Km acima do limite, semana a semana, pelos reportes do motorista no período.
      let excessKm = 0;
      if (limit && rental?.mileageLogs?.length) {
        let prev = new Date(rental.startDate);
        for (const log of rental.mileageLogs) {
          const d = new Date(log.date);
          const intervalDays = Math.max(1, (d.getTime() - prev.getTime()) / DAY);
          if (d > start && d <= end) excessKm += Math.max(0, log.kmDriven - (limit * intervalDays) / 7);
          prev = d;
        }
      }
      excessKm = Math.round(excessKm);

      return {
        vehicleId: v._id,
        licensePlate: v.licensePlate,
        name: `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
        driverName: rental?.driverId?.name ?? null,
        currentMileage: Math.max(v.mileage || 0, ...readings.map((r) => r.mileage)),
        kmInPeriod: km,
        kmPerDay: round2(km / days),
        kmPerWeek,
        weeklyKmLimit: limit,
        overLimit: limit ? kmPerWeek > limit : false,
        excessKm,
        excessKmValue: rental?.excessKmFee ? round2(excessKm * rental.excessKmFee) : null,
        readingsInPeriod: n,
        lastReadingAt: lastReading?.date ?? null,
        income: round2(income),
        expenses: round2(expenses),
        costPerKm: perKm(expenses, km),
        revenuePerKm: perKm(income, km),
        marginPerKm: perKm(income - expenses, km),
      };
    }).sort((a, b) => b.kmInPeriod - a.kmInPeriod);

    const totalKm = rows.reduce((s, r) => s + r.kmInPeriod, 0);
    // Custo/receita por km só com veículos que têm km medido — senão as despesas de quem
    // não tem leitura inflariam o custo por km da frota.
    const measured = rows.filter((r) => r.kmInPeriod > 0);
    const measuredIncome = measured.reduce((s, r) => s + r.income, 0);
    const measuredExpenses = measured.reduce((s, r) => s + r.expenses, 0);

    return {
      days,
      from: start,
      to: end,
      totals: {
        kmInPeriod: totalKm,
        kmPerDay: round2(totalKm / days),
        kmPerWeekPerVehicle: measured.length ? round2(totalKm / weeks / measured.length) : 0,
        costPerKm: perKm(measuredExpenses, totalKm),
        revenuePerKm: perKm(measuredIncome, totalKm),
        vehiclesOverLimit: rows.filter((r) => r.overLimit).length,
        excessKm: rows.reduce((s, r) => s + r.excessKm, 0),
        excessKmValue: round2(rows.reduce((s, r) => s + (r.excessKmValue ?? 0), 0)),
        vehiclesWithoutReadings: rows.filter((r) => r.readingsInPeriod === 0).length,
      },
      vehicles: rows,
    };
  }
}
