import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

export enum CustomerType {
  PF = 'PF',
  PJ = 'PJ',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({
  timestamps: true,
  collection: 'customers',
})
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: String, enum: CustomerType, required: true })
  type: CustomerType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  document: string;

  @Prop({ trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({
    type: {
      street: String,
      number: String,
      complement: String,
      neighborhood: String,
      city: String,
      state: String,
      zipCode: String,
    },
    default: {},
  })
  address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  @Prop({ type: String, enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ tenantId: 1, document: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, name: 'text', email: 'text' });
