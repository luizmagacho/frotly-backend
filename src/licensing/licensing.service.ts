import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateLicensingDto } from './dto/create-licensing.dto';
import { UpdateLicensingDto } from './dto/update-licensing.dto';
import { Licensing, LicensingDocument, LicensingStatus } from './schemas/licensing.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryType, FinancialEntryCategory, FinancialEntryStatus } from '../financial-entries/schemas/financial-entry.schema';

@Injectable()
export class LicensingService {
  constructor(
    @InjectModel(Licensing.name) private licensingModel: Model<LicensingDocument>,
    private financialEntriesService: FinancialEntriesService,
  ) {}

  async create(tenantId: string, dto: CreateLicensingDto) {
    const licensing = new this.licensingModel({
      ...dto,
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: new Types.ObjectId(dto.vehicleId),
    });

    const saved = await licensing.save();

    if (dto.value > 0) {
      await this.financialEntriesService.create({
        tenantId,
        vehicleId: dto.vehicleId,
        type: FinancialEntryType.EXPENSE,
        category: FinancialEntryCategory.LICENCIAMENTO,
        amount: dto.value,
        date: dto.dueDate,
        description: `Licenciamento ${dto.year}`,
        status: saved.status === LicensingStatus.PAID ? FinancialEntryStatus.PAID : FinancialEntryStatus.PENDING,
        sourceId: saved._id.toString(),
      } as any);
    }

    return saved;
  }

  async findAll(tenantId: string, vehicleId?: string) {
    const query: any = { tenantId: new Types.ObjectId(tenantId) };
    if (vehicleId) {
      query.vehicleId = new Types.ObjectId(vehicleId);
    }
    return this.licensingModel.find(query).populate('vehicleId', 'licensePlate brand model').sort({ dueDate: 1 }).exec();
  }

  async findOne(tenantId: string, id: string) {
    const licensing = await this.licensingModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) }).populate('vehicleId').exec();
    if (!licensing) throw new NotFoundException('Licenciamento não encontrado');
    return licensing;
  }

  async update(tenantId: string, id: string, dto: UpdateLicensingDto) {
    const updated = await this.licensingModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: dto },
      { new: true },
    ).exec();
    if (!updated) throw new NotFoundException('Licenciamento não encontrado');
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const deleted = await this.licensingModel.findOneAndDelete({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) }).exec();
    if (!deleted) throw new NotFoundException('Licenciamento não encontrado');
    return deleted;
  }
}
