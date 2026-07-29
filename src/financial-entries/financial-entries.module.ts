import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialEntriesController } from './financial-entries.controller';
import { FinancialEntriesService } from './financial-entries.service';
import { FinancialEntry, FinancialEntrySchema } from './schemas/financial-entry.schema';
import { Maintenance, MaintenanceSchema } from '../maintenances/schemas/maintenance.schema';
import { Rental, RentalSchema } from '../rentals/schemas/rental.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinancialEntry.name, schema: FinancialEntrySchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Rental.name, schema: RentalSchema },
    ]),
  ],
  controllers: [FinancialEntriesController],
  providers: [FinancialEntriesService],
  exports: [FinancialEntriesService],
})
export class FinancialEntriesModule {}
