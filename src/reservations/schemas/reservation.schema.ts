import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReservationDocument = Reservation & Document;

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Schema({
  timestamps: true,
  collection: 'reservations',
})
export class Reservation {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle' })
  vehicleId?: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: Number })
  estimatedAmount?: number;

  @Prop({ type: String, enum: ReservationStatus, default: ReservationStatus.PENDING })
  status: ReservationStatus;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);

ReservationSchema.index({ tenantId: 1, customerId: 1 });
ReservationSchema.index({ tenantId: 1, vehicleId: 1 });
ReservationSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });
