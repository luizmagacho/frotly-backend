import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FinancialEntry,
  FinancialEntryCategory,
  FinancialEntryDocument,
  FinancialEntryType,
  FinancialEntryStatus,
} from './schemas/financial-entry.schema';
import { Maintenance, MaintenanceDocument, MaintenanceStatus } from '../maintenances/schemas/maintenance.schema';
import { Rental, RentalDocument, PaymentStatus } from '../rentals/schemas/rental.schema';
import { IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFinancialEntryDto {
  @IsMongoId()
  vehicleId: string;

  @IsEnum(FinancialEntryType)
  type: FinancialEntryType;

  @IsEnum(FinancialEntryCategory)
  category: FinancialEntryCategory;

  @IsNumber()
  @Min(0)
  amount: number;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  @IsOptional()
  @IsMongoId()
  sourceId?: string;
}

export class UpdateFinancialEntryDto {
  @IsOptional()
  @IsEnum(FinancialEntryType)
  type?: FinancialEntryType;

  @IsOptional()
  @IsEnum(FinancialEntryCategory)
  category?: FinancialEntryCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  @IsOptional()
  @IsMongoId()
  sourceId?: string;
}

export interface LedgerEntry {
  source: 'MANUAL' | 'AUTO';
  sourceId: string;
  type: FinancialEntryType;
  category: FinancialEntryCategory;
  amount: number;
  date: Date;
  description: string;
  editable: boolean;
  status: FinancialEntryStatus;
}

@Injectable()
export class FinancialEntriesService {
  constructor(
    @InjectModel(FinancialEntry.name)
    private financialEntryModel: Model<FinancialEntryDocument>,
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
    @InjectModel(Rental.name)
    private rentalModel: Model<RentalDocument>,
  ) {}

  /**
   * Os campos de referência do schema são `Mixed` (declarados como Types.ObjectId), então o
   * Mongoose NÃO converte texto para ObjectId. Um tenantId gravado como texto fica invisível
   * para o tenantPlugin, que filtra por ObjectId — o lançamento some do financeiro e o
   * upsert por sourceId passa a duplicar. Por isso todo lançamento passa por aqui.
   */
  private normalizeRefs<T extends Record<string, any>>(dto: T): T {
    const out: any = { ...dto };
    for (const key of ['tenantId', 'vehicleId']) {
      const v = out[key];
      if (typeof v === 'string' && Types.ObjectId.isValid(v)) out[key] = new Types.ObjectId(v);
    }
    if (out.sourceId != null) out.sourceId = String(out.sourceId);
    return out;
  }

  create(dto: CreateFinancialEntryDto): Promise<FinancialEntry> {
    const entry = new this.financialEntryModel(this.normalizeRefs(dto as any));
    return entry.save();
  }

  findAll(vehicleId?: string): Promise<FinancialEntry[]> {
    const filter: any = {};
    if (vehicleId) filter.vehicleId = new Types.ObjectId(vehicleId);
    return this.financialEntryModel.find(filter).sort({ date: -1 });
  }

  async update(id: string, dto: UpdateFinancialEntryDto): Promise<FinancialEntry> {
    const entry = await this.financialEntryModel.findByIdAndUpdate(id, { $set: this.normalizeRefs(dto as any) }, { new: true });
    if (!entry) throw new NotFoundException(`Lançamento ${id} não encontrado.`);
    return entry;
  }

  async upsertBySourceId(sourceId: string, dto: any): Promise<FinancialEntry> {
    const data = this.normalizeRefs({ ...dto, sourceId: String(sourceId) });
    const existing = await this.financialEntryModel.findOne({ sourceId: data.sourceId });
    if (existing) {
      return this.financialEntryModel.findByIdAndUpdate(existing._id, { $set: data }, { new: true }) as any;
    }
    return new this.financialEntryModel(data).save();
  }

  async remove(id: string): Promise<void> {
    const result = await this.financialEntryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException(`Lançamento ${id} não encontrado.`);
  }

  async removeBySourceId(sourceId: string): Promise<void> {
    await this.financialEntryModel.deleteMany({ sourceId: String(sourceId) });
  }

  async getVehicleLedger(vehicleId: string) {
    const vehicleObjectId = new Types.ObjectId(vehicleId);

    const manualEntries = await this.financialEntryModel.find({ vehicleId: vehicleObjectId }).lean();

    const entries: LedgerEntry[] = [];

    for (const e of manualEntries) {
      entries.push({
        source: e.sourceId ? 'AUTO' : 'MANUAL',
        sourceId: e.sourceId?.toString() || e._id.toString(),
        type: e.type,
        category: e.category,
        amount: e.amount,
        date: e.date,
        description: e.description || '',
        editable: !e.sourceId,
        status: (e as any).status || FinancialEntryStatus.PAID,
      });
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalIncome = entries.filter((e) => e.type === FinancialEntryType.INCOME).reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter((e) => e.type === FinancialEntryType.EXPENSE).reduce((s, e) => s + e.amount, 0);

    return {
      entries,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
