import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type HistoryEventDocument = HistoryEvent & Document;

export enum EventSource {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  DETRAN_PR = 'DETRAN_PR',
}

export enum EventType {
  RENTAL_STARTED = 'RENTAL_STARTED',
  RENTAL_ENDED = 'RENTAL_ENDED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  MAINTENANCE_SCHEDULED = 'MAINTENANCE_SCHEDULED',
  MAINTENANCE_COMPLETED = 'MAINTENANCE_COMPLETED',
  FINE_DETECTED = 'FINE_DETECTED',
  FINE_PAID = 'FINE_PAID',
  IPVA_DUE = 'IPVA_DUE',
  IPVA_PAID = 'IPVA_PAID',
  LICENSING_DUE = 'LICENSING_DUE',
  LICENSING_COMPLETED = 'LICENSING_COMPLETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  DOCUMENT_UPDATED = 'DOCUMENT_UPDATED',
  NOTE_ADDED = 'NOTE_ADDED',
}

@Schema({ timestamps: true, collection: 'history_events' })
export class HistoryEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Driver', default: null })
  driverId: Types.ObjectId;

  @Prop({ type: String, enum: EventType, required: true })
  type: EventType;

  @Prop({ type: String, enum: EventSource, default: EventSource.USER })
  source: EventSource;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: Date.now })
  occurredAt: Date;

  @Prop({ trim: true })
  createdBy: string;
}

export const HistoryEventSchema = SchemaFactory.createForClass(HistoryEvent);

HistoryEventSchema.index({ vehicleId: 1, occurredAt: -1 });
HistoryEventSchema.index({ driverId: 1 });
HistoryEventSchema.index({ type: 1 });
