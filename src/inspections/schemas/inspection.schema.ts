import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InspectionDocument = Inspection & Document;

export enum InspectionType {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
}

export enum FuelLevel {
  VAZIO = 'VAZIO',
  QUARTO = '1/4',
  METADE = '1/2',
  TRES_QUARTOS = '3/4',
  CHEIO = 'CHEIO',
}

class DamageItem {
  @Prop({ trim: true })
  location: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ trim: true })
  photoUrl: string;
}

@Schema({ timestamps: true, collection: 'inspections' })
export class Inspection {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rental', required: true, index: true })
  rentalId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', required: true, index: true })
  driverId: Types.ObjectId;

  @Prop({ type: String, enum: InspectionType, required: true })
  type: InspectionType;

  @Prop({ type: Number, min: 0 })
  mileage: number;

  @Prop({ type: String, enum: FuelLevel })
  fuelLevel: FuelLevel;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({
    type: [
      {
        location: { type: String, trim: true },
        description: { type: String, trim: true },
        photoUrl: { type: String, trim: true },
      },
    ],
    default: [],
  })
  damages: DamageItem[];

  @Prop({ trim: true })
  observations: string;

  @Prop({ trim: true })
  inspectorName: string;

  @Prop({ trim: true })
  signature: string;
}

export const InspectionSchema = SchemaFactory.createForClass(Inspection);

InspectionSchema.index({ tenantId: 1, rentalId: 1 });
InspectionSchema.index({ tenantId: 1, vehicleId: 1 });
InspectionSchema.index({ tenantId: 1, type: 1 });
