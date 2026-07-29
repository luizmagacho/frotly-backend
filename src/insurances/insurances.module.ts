import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';
import { Insurance, InsuranceSchema } from './schemas/insurance.schema';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Insurance.name, schema: InsuranceSchema }]),
    FinancialEntriesModule,
  ],
  controllers: [InsurancesController],
  providers: [InsurancesService],
  exports: [InsurancesService],
})
export class InsurancesModule {}
