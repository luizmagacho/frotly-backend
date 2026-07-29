import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum FuelType {
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  DIESEL = 'DIESEL',
  CNG = 'CNG', // Compressed Natural Gas (GNV)
}

@Schema({ timestamps: true })
export class Refuel {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: string;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: string;

  @Prop({ type: Types.ObjectId, ref: 'Driver', required: false })
  driverId?: string;

  @Prop({ required: true })
  date: Date;

  @Prop()
  stationName: string;

  @Prop({ required: true, enum: FuelType })
  fuelType: FuelType;

  @Prop({ required: true })
  volume: number; // in liters/gallons

  @Prop({ required: true })
  pricePerUnit: number;

  @Prop({ required: true })
  totalCost: number;

  @Prop({ required: true })
  currentMileage: number;

  @Prop({ default: false })
  isFullTank: boolean;

  @Prop()
  notes: string;
}

export type RefuelDocument = Refuel & Document;
export const RefuelSchema = SchemaFactory.createForClass(Refuel);
