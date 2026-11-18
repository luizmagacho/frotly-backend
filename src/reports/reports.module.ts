import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Maintenance, MaintenanceSchema } from '../maintenances/schemas/maintenance.schema';
import { DriversModule } from '../drivers/drivers.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RentalsModule } from '../rentals/rentals.module';
import { TenantsModule } from '../tenants/tenants.module';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Mileage, MileageSchema } from '../mileage/schemas/mileage.schema';
import { FinancialEntry, FinancialEntrySchema } from '../financial-entries/schemas/financial-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Mileage.name, schema: MileageSchema },
      { name: FinancialEntry.name, schema: FinancialEntrySchema },
    ]),
    DriversModule,
    VehiclesModule,
    RentalsModule,
    TenantsModule,
    FinancialEntriesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
