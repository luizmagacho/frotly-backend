import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateLicensingDto } from './dto/create-licensing.dto';
import { UpdateLicensingDto } from './dto/update-licensing.dto';
import { Licensing, LicensingDocument, LicensingStatus } from './schemas/licensing.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryType, FinancialEntryCategory, FinancialEntryStatus } from '../financial-entries/schemas/financial-entry.schema';

/**
 * Licenciamento anual por veículo. Cada registro mantém um lançamento de despesa
 * LICENCIAMENTO no financeiro do veículo (sourceId = _id do licenciamento), atualizado
 * quando o registro muda e removido junto com ele.
 */
@Injectable()
export class LicensingService {
  constructor(
    @InjectModel(Licensing.name) private licensingModel: Model<LicensingDocument>,
    private financialEntriesService: FinancialEntriesService,
  ) {}

  async create(tenantId: string, dto: CreateLicensingDto) {
    await this.ensureUnique(tenantId, dto.vehicleId, dto.year);

    const status = dto.status ?? LicensingStatus.PENDING;
    const licensing = new this.licensingModel({
      ...dto,
      status,
      paidAt: status === LicensingStatus.PAID ? new Date() : undefined,
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: new Types.ObjectId(dto.vehicleId),
    });

    const saved = await licensing.save();
    await this.syncFinancial(tenantId, saved);
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
    const licensing = await this.licensingModel
      .findOne({ _id: this.toId(id), tenantId: new Types.ObjectId(tenantId) })
      .populate('vehicleId', 'licensePlate brand model')
      .exec();
    if (!licensing) throw new NotFoundException('Licenciamento não encontrado');
    return licensing;
  }

  async update(tenantId: string, id: string, dto: UpdateLicensingDto) {
    const licensing = await this.getDoc(tenantId, id);

    const vehicleId = dto.vehicleId ?? licensing.vehicleId.toString();
    const year = dto.year ?? licensing.year;
    if (vehicleId !== licensing.vehicleId.toString() || year !== licensing.year) {
      await this.ensureUnique(tenantId, vehicleId, year, licensing._id.toString());
    }

    const { vehicleId: newVehicle, ...rest } = dto;
    Object.assign(licensing, rest);
    if (newVehicle) licensing.vehicleId = new Types.ObjectId(newVehicle);
    if (dto.status === LicensingStatus.PAID && !licensing.paidAt) licensing.paidAt = new Date();
    if (dto.status && dto.status !== LicensingStatus.PAID) licensing.paidAt = undefined;

    const saved = await licensing.save();
    await this.syncFinancial(tenantId, saved);
    return this.findOne(tenantId, id);
  }

  async markAsPaid(tenantId: string, id: string, paidAt?: string) {
    const licensing = await this.getDoc(tenantId, id);
    licensing.status = LicensingStatus.PAID;
    licensing.paidAt = paidAt ? new Date(paidAt) : new Date();
    const saved = await licensing.save();
    await this.syncFinancial(tenantId, saved);
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const deleted = await this.licensingModel.findOneAndDelete({ _id: this.toId(id), tenantId: new Types.ObjectId(tenantId) }).exec();
    if (!deleted) throw new NotFoundException('Licenciamento não encontrado');
    await this.financialEntriesService.removeBySourceId(deleted._id.toString());
    return deleted;
  }

  private toId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Licenciamento não encontrado');
    return new Types.ObjectId(id);
  }

  private async getDoc(tenantId: string, id: string): Promise<LicensingDocument> {
    const licensing = await this.licensingModel.findOne({ _id: this.toId(id), tenantId: new Types.ObjectId(tenantId) }).exec();
    if (!licensing) throw new NotFoundException('Licenciamento não encontrado');
    return licensing;
  }

  /** Um licenciamento por veículo por ano. */
  private async ensureUnique(tenantId: string, vehicleId: string, year: number, exceptId?: string) {
    const query: any = {
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: new Types.ObjectId(vehicleId),
      year,
    };
    if (exceptId) query._id = { $ne: new Types.ObjectId(exceptId) };
    if (await this.licensingModel.exists(query)) {
      throw new ConflictException(`Já existe licenciamento ${year} para este veículo.`);
    }
  }

  private async syncFinancial(tenantId: string, licensing: LicensingDocument) {
    const sourceId = licensing._id.toString();
    if (!(licensing.value > 0)) {
      await this.financialEntriesService.removeBySourceId(sourceId);
      return;
    }
    await this.financialEntriesService.upsertBySourceId(sourceId, {
      tenantId: licensing.tenantId,
      vehicleId: licensing.vehicleId.toString(),
      type: FinancialEntryType.EXPENSE,
      category: FinancialEntryCategory.LICENCIAMENTO,
      amount: licensing.value,
      date: licensing.paidAt || licensing.dueDate,
      description: `Licenciamento ${licensing.year}`,
      status: licensing.status === LicensingStatus.PAID ? FinancialEntryStatus.PAID : FinancialEntryStatus.PENDING,
    });
  }
}
