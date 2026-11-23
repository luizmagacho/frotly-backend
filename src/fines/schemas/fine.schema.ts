import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum FineStatus {
  /** Recebida, ainda não paga. Vencida = PENDING com dueDate no passado (calculado, não gravado). */
  PENDING = 'PENDING',
  PAID = 'PAID',
  /** Em recurso/defesa — não conta como paga nem como cancelada. */
  APPEALED = 'APPEALED',
  /** Recurso deferido ou multa anulada — sai do financeiro. */
  CANCELLED = 'CANCELLED',
}

export enum DriverChargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

export type FineDocument = Fine & Document;

@Schema({ timestamps: true, collection: 'fines' })
export class Fine {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  /** Motorista responsável — quem estava com o carro na data da infração. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Driver', index: true })
  driverId?: Types.ObjectId;

  /** Número do auto de infração (AIT). */
  @Prop({ required: true, trim: true })
  noticeNumber: string;

  @Prop({ required: true })
  infractionDate: Date;

  @Prop({ required: true, trim: true })
  description: string;

  /** Código da infração no CTB (ex.: 745-50). */
  @Prop({ trim: true })
  infractionCode?: string;

  @Prop({ trim: true })
  location?: string;

  /** Órgão autuador (DETRAN-PR, PRF, Setran Curitiba...). */
  @Prop({ trim: true })
  issuingAgency?: string;

  @Prop({ required: true, min: 0 })
  value: number;

  @Prop({ min: 0, default: 0 })
  points: number;

  @Prop()
  dueDate?: Date;

  @Prop({ type: String, enum: FineStatus, default: FineStatus.PENDING, index: true })
  status: FineStatus;

  @Prop()
  paidAt?: Date;

  /** Indicação do condutor feita ao órgão (os pontos vão para a CNH do motorista). */
  @Prop({ default: false })
  driverIndicated: boolean;

  /** A locadora repassa o valor da multa ao motorista. */
  @Prop({ default: false })
  chargeToDriver: boolean;

  @Prop({ type: String, enum: DriverChargeStatus, default: DriverChargeStatus.PENDING })
  driverChargeStatus: DriverChargeStatus;

  /**
   * Chave do lançamento de receita do repasse no financeiro. O lançamento de despesa usa o
   * próprio _id da multa como sourceId; o repasse precisa de uma chave própria.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId })
  driverChargeRef?: Types.ObjectId;

  @Prop({ trim: true })
  notes?: string;

  /** De onde veio: cadastrada à mão ou encontrada na consulta ao Detran (ex.: DETRAN_RJ). */
  @Prop({ trim: true, default: 'MANUAL' })
  source?: string;
}

export const FineSchema = SchemaFactory.createForClass(Fine);
FineSchema.index({ tenantId: 1, noticeNumber: 1 });
