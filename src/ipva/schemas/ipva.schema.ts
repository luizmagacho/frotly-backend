import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum IpvaStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export class IpvaInstallment {
  @Prop({ required: true })
  installmentNumber: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true, enum: IpvaStatus, default: IpvaStatus.PENDING })
  status: IpvaStatus;

  @Prop({ type: Types.ObjectId, ref: 'FinancialEntry' })
  financialEntryId?: string; // Link to the specific financial entry in the ledger
}

@Schema({ timestamps: true })
export class Ipva {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: string;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: string;

  @Prop({ required: true })
  year: number;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ default: 0 })
  discount: number; // Discount for single quota

  @Prop({ required: true, enum: IpvaStatus, default: IpvaStatus.PENDING })
  status: IpvaStatus;

  @Prop({ type: [IpvaInstallment], default: [] })
  installments: IpvaInstallment[];
}

export type IpvaDocument = Ipva & Document;
export const IpvaSchema = SchemaFactory.createForClass(Ipva);
