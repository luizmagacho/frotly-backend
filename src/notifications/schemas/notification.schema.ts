import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  DOCUMENT_EXPIRATION = 'DOCUMENT_EXPIRATION',
  LICENSE_EXPIRATION = 'LICENSE_EXPIRATION',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  PAYMENT_UPCOMING = 'PAYMENT_UPCOMING',
  MILEAGE_REMINDER = 'MILEAGE_REMINDER',
  FINE_DETECTED = 'FINE_DETECTED',
  SYSTEM = 'SYSTEM',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Prop({ default: false, index: true })
  isRead: boolean;

  // Rota do frontend pra onde o clique na notificação deve levar (ex: /veiculos/:id)
  @Prop({ trim: true })
  link?: string;

  // Dados livres pra reconstruir contexto (vehicleId, plate, documentType, daysLeft, ...)
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
