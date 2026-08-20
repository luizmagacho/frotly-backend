import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DriverDocument = Driver & Document;

export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum LicenseCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  AB = 'AB',
  AC = 'AC',
  AD = 'AD',
  AE = 'AE',
  BD = 'BD',
  BE = 'BE',
  CD = 'CD',
  CE = 'CE',
  DE = 'DE',
  ABD = 'ABD',
  ABE = 'ABE',
  ACD = 'ACD',
  ACE = 'ACE',
  ADE = 'ADE',
  BCD = 'BCD',
  BCE = 'BCE',
  ABCD = 'ABCD',
  ABCE = 'ABCE',
  ABDE = 'ABDE',
  ABCDE = 'ABCDE',
}

@Schema({ timestamps: true, collection: 'drivers' })
export class Driver {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  cpf: string;

  @Prop({ required: true, trim: true })
  licenseNumber: string;

  @Prop({ required: true, enum: LicenseCategory })
  licenseCategory: LicenseCategory;

  @Prop({ required: true })
  licenseExpiration: Date;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  address: string;

  @Prop({ trim: true })
  city: string;

  @Prop({ trim: true })
  zipCode: string;

  @Prop({ trim: true })
  profilePhoto: string;

  @Prop({ trim: true })
  licenseDocument: string;

  @Prop({ type: String, enum: DriverStatus, default: DriverStatus.ACTIVE })
  status: DriverStatus;

  @Prop({ default: 0, min: 0, max: 5 })
  rating: number;

  @Prop({ trim: true })
  notes: string;

  @Prop({ type: [String], default: [] })
  platforms: string[];
}

export const DriverSchema = SchemaFactory.createForClass(Driver);

DriverSchema.index({ tenantId: 1, cpf: 1 }, { unique: true });
DriverSchema.index({ tenantId: 1, licenseNumber: 1 }, { unique: true });
DriverSchema.index({ status: 1 });
DriverSchema.index({ name: 'text', cpf: 'text', email: 'text' });
