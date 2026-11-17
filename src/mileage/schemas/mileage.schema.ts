import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum MileageSource {
  MANUAL = 'MANUAL',
  REFUEL = 'REFUEL',
}

export type MileageDocument = Mileage & Document;

@Schema({ timestamps: true })
export class Mileage {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, min: 0 })
  mileage: number;

  @Prop({ required: true, enum: MileageSource, default: MileageSource.MANUAL })
  source: MileageSource;

  @Prop({ required: false })
  notes?: string;
}

export const MileageSchema = SchemaFactory.createForClass(Mileage);
