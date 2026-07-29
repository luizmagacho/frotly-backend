import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VehicleDocument = Vehicle & Document;

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  DISPONIVEL = 'DISPONIVEL',
  RENTED = 'RENTED',
  ALUGADO = 'ALUGADO',
  MAINTENANCE = 'MAINTENANCE',
  EM_MANUTENCAO = 'EM_MANUTENCAO',
  INACTIVE = 'INACTIVE',
  INATIVO = 'INATIVO',
}

export enum FuelType {
  FLEX = 'FLEX',
  GASOLINE = 'GASOLINE',
  GASOLINA = 'GASOLINA',
  ETHANOL = 'ETHANOL',
  ETANOL = 'ETANOL',
  DIESEL = 'DIESEL',
  ELECTRIC = 'ELECTRIC',
  ELETRICO = 'ELETRICO',
  HYBRID = 'HYBRID',
  HIBRIDO = 'HIBRIDO',
}

export enum TransmissionType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  AUTOMATICO = 'AUTOMATICO',
  CVT = 'CVT',
  AUTOMATIZADO = 'AUTOMATIZADO',
}

@Schema({
  timestamps: true,
  collection: 'vehicles',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})
export class Vehicle {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  licensePlate: string;

  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ required: true, trim: true })
  model: string;

  @Prop({ required: true })
  year: number;

  @Prop({ required: true })
  modelYear: number;

  @Prop({ trim: true })
  color: string;

  @Prop({ required: true, trim: true })
  renavam: string;

  @Prop({ required: true, trim: true })
  chassis: string;

  @Prop({ enum: FuelType, default: FuelType.FLEX })
  fuelType: FuelType;

  @Prop({ enum: TransmissionType, default: TransmissionType.MANUAL })
  transmission: TransmissionType;

  @Prop()
  mileage: number;

  @Prop({ type: Number, default: 5 })
  seats: number;

  @Prop({ type: String, enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  status: VehicleStatus;

  @Prop({ type: Types.ObjectId, ref: 'Driver', default: null })
  currentDriverId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ trim: true })
  crlvDocument: string;

  @Prop({ trim: true })
  insuranceDocument: string;

  @Prop()
  insuranceExpiration: Date;

  @Prop()
  ipvaDueDate: Date;

  @Prop()
  licensingDueDate: Date;

  @Prop()
  nextMaintenanceDate: Date;

  @Prop()
  nextMaintenanceMileage: number;

  @Prop()
  purchaseValue: number;

  @Prop()
  currentValue: number;

  @Prop({ trim: true })
  notes: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

VehicleSchema.virtual('plate')
  .get(function () {
    return this.licensePlate;
  })
  .set(function (val: string) {
    this.licensePlate = val;
  });

VehicleSchema.virtual('purchasePrice')
  .get(function () {
    return this.purchaseValue;
  })
  .set(function (val: number) {
    this.purchaseValue = val;
  });

VehicleSchema.index({ tenantId: 1, licensePlate: 1 }, { unique: true });
VehicleSchema.index({ tenantId: 1, renavam: 1 }, { unique: true });
VehicleSchema.index({ tenantId: 1, chassis: 1 }, { unique: true });
VehicleSchema.index({ status: 1 });
VehicleSchema.index({ brand: 'text', model: 'text', licensePlate: 'text' });
