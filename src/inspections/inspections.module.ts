import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { Inspection, InspectionSchema } from './schemas/inspection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inspection.name, schema: InspectionSchema }]),
  ],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
