import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Maintenance, MaintenanceDocument, MaintenanceStatus } from '../maintenances/schemas/maintenance.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryCategory } from '../financial-entries/schemas/financial-entry.schema';
import { DriversService } from '../drivers/drivers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RentalsService } from '../rentals/rentals.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
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
    const vehicles = await this.vehiclesService['vehicleModel'].find().select('_id licensePlate brand model').lean();
    
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

  async getMileagePerVehicle(): Promise<any[]> {
    const vehicles = await this.vehiclesService['vehicleModel'].find().select('_id licensePlate brand model mileage').lean();
    
    return vehicles.map(v => ({
      vehicleId: v._id,
      licensePlate: v.licensePlate,
      name: `${v.brand} ${v.model}`,
      mileage: v.mileage || 0
    })).sort((a, b) => b.mileage - a.mileage);
  }
}
