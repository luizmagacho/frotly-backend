import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RentalDocument = Rental & Document;

export enum RentalStatus {
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: true })
export class Payment {
  @Prop({ required: true })
  dueDate: Date;

  @Prop()
  paidAt: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ trim: true })
  paymentMethod: string;

  @Prop({ trim: true })
  receiptPath: string;

  @Prop({ trim: true })
  notes: string;
}

@Schema({ _id: true })
export class MileageLog {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  previousMileage: number;

  @Prop({ required: true })
  newMileage: number;

  @Prop({ required: true })
  kmDriven: number;
}

@Schema({ timestamps: true, collection: 'rentals' })
export class Rental {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', required: true })
  driverId: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  expectedEndDate: Date;

  @Prop({ required: true })
  rentalAmount: number;

  @Prop({ type: String, enum: PaymentFrequency, required: true })
  paymentFrequency: PaymentFrequency;

  @Prop({ type: String, enum: RentalStatus, default: RentalStatus.ACTIVE })
  status: RentalStatus;

  @Prop({ type: [Payment], default: [] })
  payments: Payment[];

  @Prop({ type: [MileageLog], default: [] })
  mileageLogs: MileageLog[];

  @Prop({ type: Number, default: 0 })
  securityDeposit: number;

  @Prop({ trim: true })
  contractPath: string;

  @Prop({ trim: true })
  notes: string;
}

export const RentalSchema = SchemaFactory.createForClass(Rental);

RentalSchema.index({ tenantId: 1, vehicleId: 1 });
RentalSchema.index({ tenantId: 1, driverId: 1 });
RentalSchema.index({ tenantId: 1, status: 1 });
RentalSchema.index({ 'payments.dueDate': 1, 'payments.status': 1 });
