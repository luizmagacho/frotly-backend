import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MaintenanceDocument = Maintenance & Document;

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  INSPECTION = 'INSPECTION',
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true, collection: 'maintenances' })
export class Maintenance {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: String, enum: MaintenanceType, required: true })
  type: MaintenanceType;

  @Prop({ type: String, enum: MaintenanceStatus, default: MaintenanceStatus.SCHEDULED })
  status: MaintenanceStatus;

  @Prop({ required: true })
  scheduledDate: Date;

  @Prop()
  completedDate: Date;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ trim: true })
  workshopName: string;

  @Prop({ trim: true })
  workshopPhone: string;

  @Prop({ type: [String], default: [] })
  services: string[];

  @Prop({ type: [String], default: [] })
  parts: string[];

  @Prop({ default: 0 })
  cost: number;

  @Prop()
  mileageAtService: number;

  @Prop()
  nextServiceMileage: number;

  @Prop()
  nextServiceDate: Date;

  @Prop({ trim: true })
  receiptPath: string;

  @Prop({ trim: true })
  notes: string;
}

export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);

MaintenanceSchema.index({ tenantId: 1, vehicleId: 1 });
MaintenanceSchema.index({ tenantId: 1, status: 1 });
MaintenanceSchema.index({ tenantId: 1, scheduledDate: 1 });
