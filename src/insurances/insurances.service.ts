import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { Insurance, InsuranceDocument, InsuranceStatus } from './schemas/insurance.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryType, FinancialEntryCategory, FinancialEntryStatus } from '../financial-entries/schemas/financial-entry.schema';

@Injectable()
export class InsurancesService {
  constructor(
    @InjectModel(Insurance.name) private insuranceModel: Model<InsuranceDocument>,
    private financialEntriesService: FinancialEntriesService,
  ) {}

  async create(tenantId: string, createInsuranceDto: CreateInsuranceDto) {
    const insurance = new this.insuranceModel({
      ...createInsuranceDto,
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: new Types.ObjectId(createInsuranceDto.vehicleId),
    });

    const saved = await insurance.save();

    if (createInsuranceDto.cost > 0) {
      const installments = createInsuranceDto.installments || 1;
      const installmentAmount = createInsuranceDto.cost / installments;

      for (let i = 0; i < installments; i++) {
        const entryDate = new Date(createInsuranceDto.startDate);
        entryDate.setMonth(entryDate.getMonth() + i);

        await this.financialEntriesService.create({
          tenantId,
          vehicleId: createInsuranceDto.vehicleId,
          type: FinancialEntryType.EXPENSE,
          category: FinancialEntryCategory.SEGURO,
          amount: installmentAmount,
          date: entryDate,
          description: `Seguro (Parcela ${i + 1}/${installments})${createInsuranceDto.provider ? ` - ${createInsuranceDto.provider}` : ''}`,
          status: FinancialEntryStatus.PENDING,
          sourceId: saved._id.toString(),
        } as any);
      }
    }

    return saved;
  }

  async findAll(tenantId: string, vehicleId?: string) {
    const query: any = { tenantId: new Types.ObjectId(tenantId) };
    if (vehicleId) {
      query.vehicleId = new Types.ObjectId(vehicleId);
    }
    return this.insuranceModel.find(query).populate('vehicleId', 'licensePlate brand model').sort({ endDate: 1 }).exec();
  }

  async findOne(tenantId: string, id: string) {
    const insurance = await this.insuranceModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) }).populate('vehicleId').exec();
    if (!insurance) throw new NotFoundException('Seguro não encontrado');
    return insurance;
  }

  async update(tenantId: string, id: string, updateInsuranceDto: UpdateInsuranceDto) {
    const updated = await this.insuranceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: updateInsuranceDto },
      { new: true }
    ).exec();
    if (!updated) throw new NotFoundException('Seguro não encontrado');
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const deleted = await this.insuranceModel.findOneAndDelete({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) }).exec();
    if (!deleted) throw new NotFoundException('Seguro não encontrado');
    return deleted;
  }
}
