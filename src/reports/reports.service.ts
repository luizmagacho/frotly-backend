import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Maintenance, MaintenanceDocument, MaintenanceStatus } from '../maintenances/schemas/maintenance.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntry, FinancialEntryCategory, FinancialEntryDocument, FinancialEntryType } from '../financial-entries/schemas/financial-entry.schema';
import { Vehicle, VehicleDocument } from '../vehicles/schemas/vehicle.schema';
import { Mileage, MileageDocument } from '../mileage/schemas/mileage.schema';
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
   * Rodagem e custo por km (plano Pro): quanto cada veículo rodou no período, a média por
   * dia e quanto custou/rendeu por km rodado, a partir das leituras de quilometragem e dos
   * lançamentos financeiros do veículo.
   */
  async getMileagePerVehicle(days = 90): Promise<any> {
    const DAY = 24 * 60 * 60 * 1000;
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY);

    const [vehicles, readings, money] = await Promise.all([
      this.vehicleModel.find().select('_id licensePlate brand model mileage').lean(),
      this.mileageModel.aggregate([
        { $match: { date: { $lte: end } } },
        {
          $group: {
            _id: '$vehicleId',
            // Hodômetro só cresce: a maior leitura até o início é a última antes do período.
            before: { $max: { $cond: [{ $lte: ['$date', start] }, '$mileage', null] } },
            firstIn: { $min: { $cond: [{ $gt: ['$date', start] }, '$mileage', null] } },
            lastIn: { $max: { $cond: [{ $gt: ['$date', start] }, '$mileage', null] } },
            readingsIn: { $sum: { $cond: [{ $gt: ['$date', start] }, 1, 0] } },
            lastReadingAt: { $max: '$date' },
          },
        },
      ]),
      this.financialEntryModel.aggregate([
        { $match: { date: { $gt: start, $lte: end }, vehicleId: { $ne: null } } },
        { $group: { _id: { vehicleId: '$vehicleId', type: '$type' }, total: { $sum: '$amount' } } },
      ]),
    ]);

    const readingBy = new Map(readings.map((r: any) => [String(r._id), r]));
    const moneyBy = new Map<string, { income: number; expenses: number }>();
    for (const m of money as any[]) {
      const key = String(m._id.vehicleId);
      const cur = moneyBy.get(key) ?? { income: 0, expenses: 0 };
      if (m._id.type === FinancialEntryType.INCOME) cur.income += m.total;
      else cur.expenses += m.total;
      moneyBy.set(key, cur);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const perKm = (value: number, km: number) => (km > 0 ? round2(value / km) : null);

    const rows = vehicles.map((v: any) => {
      const r: any = readingBy.get(String(v._id));
      const base = r?.before ?? r?.firstIn;
      const km = r?.lastIn != null && base != null ? Math.max(0, r.lastIn - base) : 0;
      const { income, expenses } = moneyBy.get(String(v._id)) ?? { income: 0, expenses: 0 };
      return {
        vehicleId: v._id,
        licensePlate: v.licensePlate,
        name: `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
        currentMileage: Math.max(v.mileage || 0, r?.lastIn ?? 0, r?.before ?? 0),
        kmInPeriod: km,
        kmPerDay: round2(km / days),
        readingsInPeriod: r?.readingsIn ?? 0,
        lastReadingAt: r?.lastReadingAt ?? null,
        income: round2(income),
        expenses: round2(expenses),
        costPerKm: perKm(expenses, km),
        revenuePerKm: perKm(income, km),
        marginPerKm: perKm(income - expenses, km),
      };
    }).sort((a, b) => b.kmInPeriod - a.kmInPeriod);

    const totalKm = rows.reduce((s, r) => s + r.kmInPeriod, 0);
    const totalIncome = rows.reduce((s, r) => s + r.income, 0);
    const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
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
        income: round2(totalIncome),
        expenses: round2(totalExpenses),
        costPerKm: perKm(measuredExpenses, totalKm),
        revenuePerKm: perKm(measuredIncome, totalKm),
        vehiclesWithoutReadings: rows.filter((r) => r.readingsInPeriod === 0).length,
      },
      vehicles: rows,
    };
  }
}
