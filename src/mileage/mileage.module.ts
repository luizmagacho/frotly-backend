import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MileageService } from './mileage.service';
import { MileageController } from './mileage.controller';
import { Mileage, MileageSchema } from './schemas/mileage.schema';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mileage.name, schema: MileageSchema }]),
    VehiclesModule,
  ],
  controllers: [MileageController],
  providers: [MileageService],
  exports: [MileageService],
})
export class MileageModule {}
