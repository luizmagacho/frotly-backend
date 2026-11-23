import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type DetranQueryDocument = DetranQuery & Document;

/**
 * Registro de cada consulta feita ao Detran (via Infosimples): serve para controlar o
 * gasto (teto mensal), evitar consultas repetidas e mostrar a última verificação.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'detran_queries' })
export class DetranQuery {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', required: true })
  vehicleId: Types.ObjectId;

  @Prop({ trim: true }) plate?: string;
  @Prop({ required: true }) uf: string;
  /** fines | licensing | ipva */
  @Prop({ required: true }) kind: string;
  /** Serviço da Infosimples (ex.: detran/rj/nada-consta). */
  @Prop({ required: true }) service: string;
  /** CRON (automática) | MANUAL (botão "Consultar agora") | SCRIPT */
  @Prop({ required: true }) trigger: string;

  @Prop({ required: true }) code: number;
  @Prop() ok: boolean;
  @Prop() message?: string;
  @Prop({ default: false }) billable: boolean;
  @Prop({ default: 0 }) price: number;

  /** Resumo do que foi feito (multas encontradas/novas/pagas, registros criados). */
  @Prop({ type: MongooseSchema.Types.Mixed }) summary?: Record<string, unknown>;

  createdAt?: Date;
}

export const DetranQuerySchema = SchemaFactory.createForClass(DetranQuery);
DetranQuerySchema.index({ createdAt: -1 });
DetranQuerySchema.index({ tenantId: 1, vehicleId: 1, kind: 1, createdAt: -1 });
