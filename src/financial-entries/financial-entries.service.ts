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

  create(dto: CreateFinancialEntryDto): Promise<FinancialEntry> {
    const entry = new this.financialEntryModel({
      ...dto,
      vehicleId: new Types.ObjectId(dto.vehicleId),
    });
    return entry.save();
  }

  findAll(vehicleId?: string): Promise<FinancialEntry[]> {
    const filter: any = {};
    if (vehicleId) filter.vehicleId = new Types.ObjectId(vehicleId);
    return this.financialEntryModel.find(filter).sort({ date: -1 });
  }

  async update(id: string, dto: UpdateFinancialEntryDto): Promise<FinancialEntry> {
    const entry = await this.financialEntryModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!entry) throw new NotFoundException(`Lançamento ${id} não encontrado.`);
    return entry;
  }

  async upsertBySourceId(sourceId: string, dto: any): Promise<FinancialEntry> {
    const existing = await this.financialEntryModel.findOne({ sourceId: new Types.ObjectId(sourceId) });
    if (existing) {
      return this.financialEntryModel.findByIdAndUpdate(existing._id, { $set: dto }, { new: true }) as any;
    } else {
      const entry = new this.financialEntryModel({
        ...dto,
        vehicleId: new Types.ObjectId(dto.vehicleId),
        sourceId: new Types.ObjectId(sourceId),
      });
      return entry.save();
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.financialEntryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException(`Lançamento ${id} não encontrado.`);
  }

  async removeBySourceId(sourceId: string): Promise<void> {
    await this.financialEntryModel.deleteMany({ sourceId: new Types.ObjectId(sourceId) });
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
