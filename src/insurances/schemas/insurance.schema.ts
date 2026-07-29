import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export type InsuranceDocument = Insurance & Document;

@Schema({ timestamps: true })
export class Insurance {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  @Prop({ required: false })
  policyNumber?: string;

  @Prop({ required: false })
  provider?: string;

  @Prop({ required: false })
  brokerName?: string;

  @Prop({ required: false })
  brokerPhone?: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ required: true, min: 0 })
  cost: number;

  @Prop({ required: false, min: 0 })
  franchiseAmount?: number;

  @Prop({ required: false })
  coverageType?: string;

  @Prop({ required: true, enum: InsuranceStatus, default: InsuranceStatus.ACTIVE })
  status: InsuranceStatus;
}

export const InsuranceSchema = SchemaFactory.createForClass(Insurance);
