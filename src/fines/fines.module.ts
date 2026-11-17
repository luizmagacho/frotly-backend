import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';
import { Fine, FineSchema } from './schemas/fine.schema';
import { Rental, RentalSchema } from '../rentals/schemas/rental.schema';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fine.name, schema: FineSchema },
      { name: Rental.name, schema: RentalSchema },
    ]),
    FinancialEntriesModule,
  ],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
