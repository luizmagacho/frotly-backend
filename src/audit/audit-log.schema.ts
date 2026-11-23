import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { AUDIT_COLLECTION } from '../common/audit.plugin';

export type AuditLogDocument = AuditLog & Document;

/** Registro imutável de uma ação (gravado pelo auditPlugin; aqui só leitura). */
@Schema({ collection: AUDIT_COLLECTION, timestamps: false })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  actorId: Types.ObjectId;

  @Prop() actorName?: string;
  @Prop() actorEmail?: string;
  @Prop() ip?: string;

  @Prop({ required: true, enum: ['CREATE', 'UPDATE', 'DELETE'] })
  action: string;

  /** Nome da coleção (vehicles, rentals, financial_entries…). */
  @Prop({ required: true })
  entity: string;

  @Prop() entityId?: string;
  @Prop() label?: string;

  @Prop({ type: [{ field: String, from: MongooseSchema.Types.Mixed, to: MongooseSchema.Types.Mixed, _id: false }], default: [] })
  changes: { field: string; from: unknown; to: unknown }[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  snapshot?: unknown;

  @Prop() count?: number;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

// Append-only: nada de editar ou apagar registros de auditoria pela aplicação.
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  AuditLogSchema.pre(op as any, function () {
    throw new Error('Registros de auditoria não podem ser alterados nem excluídos.');
  });
}
