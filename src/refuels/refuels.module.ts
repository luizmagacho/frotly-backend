import { Module } from '@nestjs/common';
import { RefuelsService } from './refuels.service';
import { RefuelsController } from './refuels.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Refuel, RefuelSchema } from './schemas/refuel.schema';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Refuel.name, schema: RefuelSchema }]),
    FinancialEntriesModule,
    VehiclesModule,
  ],
  controllers: [RefuelsController],
  providers: [RefuelsService],
  exports: [RefuelsService],
})
export class RefuelsModule {}
