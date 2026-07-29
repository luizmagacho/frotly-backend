import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaintenancesController } from './maintenances.controller';
import { MaintenancesService } from './maintenances.service';
import { Maintenance, MaintenanceSchema } from './schemas/maintenance.schema';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { HistoryModule } from '../history/history.module';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
    ]),
    VehiclesModule,
    HistoryModule,
    FinancialEntriesModule,
  ],
  controllers: [MaintenancesController],
  providers: [MaintenancesService],
  exports: [MaintenancesService],
})
export class MaintenancesModule {}
