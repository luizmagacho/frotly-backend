import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LicensingStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export type LicensingDocument = Licensing & Document;

@Schema({ timestamps: true })
export class Licensing {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  @Prop({ required: true })
  year: number;

  @Prop({ required: true, min: 0 })
  value: number;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true, enum: LicensingStatus, default: LicensingStatus.PENDING })
  status: LicensingStatus;

  @Prop({ required: false })
  paidAt?: Date;
}

export const LicensingSchema = SchemaFactory.createForClass(Licensing);
