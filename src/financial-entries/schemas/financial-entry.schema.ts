import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FinancialEntryDocument = FinancialEntry & Document;

export enum FinancialEntryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum FinancialEntryCategory {
  SEGURO = 'SEGURO',
  IPVA = 'IPVA',
  LICENCIAMENTO = 'LICENCIAMENTO',
  MULTA = 'MULTA',
  MANUTENCAO = 'MANUTENCAO',
  COMBUSTIVEL = 'COMBUSTIVEL',
  ALUGUEL = 'ALUGUEL',
  VENDA = 'VENDA',
  OUTRO = 'OUTRO',
}

export enum FinancialEntryStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Schema({ timestamps: true, collection: 'financial_entries' })
export class FinancialEntry {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId: Types.ObjectId;

  @Prop({ type: String, enum: FinancialEntryType, required: true })
  type: FinancialEntryType;

  @Prop({ type: String, enum: FinancialEntryCategory, required: true })
  category: FinancialEntryCategory;

  @Prop({ type: String, enum: FinancialEntryStatus, default: FinancialEntryStatus.PAID })
  status: FinancialEntryStatus;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ trim: true })
  description: string;

  @Prop({ type: Types.ObjectId })
  sourceId: Types.ObjectId;
}

export const FinancialEntrySchema = SchemaFactory.createForClass(FinancialEntry);

FinancialEntrySchema.index({ tenantId: 1, vehicleId: 1 });
FinancialEntrySchema.index({ tenantId: 1, date: 1 });
