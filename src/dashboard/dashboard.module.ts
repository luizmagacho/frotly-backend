import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Driver, DriverSchema } from '../drivers/schemas/driver.schema';
import { Rental, RentalSchema } from '../rentals/schemas/rental.schema';
import { Maintenance, MaintenanceSchema } from '../maintenances/schemas/maintenance.schema';
import { Fine, FineSchema } from '../fines/schemas/fine.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Rental.name, schema: RentalSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Fine.name, schema: FineSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
