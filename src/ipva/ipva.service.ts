import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateIpvaDto } from './dto/create-ipva.dto';
import { UpdateIpvaDto } from './dto/update-ipva.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Ipva, IpvaDocument, IpvaStatus } from './schemas/ipva.schema';
import { Model, Types } from 'mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryCategory, FinancialEntryStatus, FinancialEntryType } from '../financial-entries/schemas/financial-entry.schema';

@Injectable()
export class IpvaService {
  constructor(
    @InjectModel(Ipva.name) private ipvaModel: Model<IpvaDocument>,
    private financialEntriesService: FinancialEntriesService,
    @Inject(REQUEST) private request: Request,
  ) {}

  private getTenantId(): string {
    const tenantId = (this.request.user as any)?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is missing from request');
    }
    return tenantId;
  }

  async create(createIpvaDto: CreateIpvaDto) {
    const tenantId = this.getTenantId();

    const existingIpva = await this.ipvaModel.findOne({
      tenantId,
      vehicleId: createIpvaDto.vehicleId,
      year: createIpvaDto.year
    });

    if (existingIpva) {
      throw new BadRequestException(`IPVA do ano ${createIpvaDto.year} j\u00e1 registrado para este ve\u00edculo.`);
    }

    const createdIpva = new this.ipvaModel({
      ...createIpvaDto,
      tenantId,
    });
    const savedIpva = await createdIpva.save();

    // Create financial entries for each installment
    for (const installment of savedIpva.installments) {
      const financialEntry = await this.financialEntriesService.create({
        vehicleId: savedIpva.vehicleId,
        type: FinancialEntryType.EXPENSE,
        category: FinancialEntryCategory.IPVA,
        amount: installment.amount,
        date: installment.dueDate || new Date(),
        description: `IPVA ${savedIpva.year} - Parcela ${installment.installmentNumber}`,
        status: installment.status === IpvaStatus.PAID ? FinancialEntryStatus.PAID : FinancialEntryStatus.PENDING,
        sourceId: savedIpva._id.toString()
      });
      installment.financialEntryId = (financialEntry as any)._id.toString();
    }
    
    // Save again to update the financial entry references
    await savedIpva.save();

    return savedIpva;
  }

  async findAll() {
    const tenantId = this.getTenantId();
    return this.ipvaModel.find({ tenantId }).populate('vehicleId').sort({ year: -1 }).exec();
  }

  async findByVehicle(vehicleId: string) {
    const tenantId = this.getTenantId();
    return this.ipvaModel.find({ tenantId, vehicleId }).sort({ year: -1 }).exec();
  }

  async findOne(id: string) {
    const tenantId = this.getTenantId();
    const ipva = await this.ipvaModel.findOne({ _id: id, tenantId }).populate('vehicleId').exec();
    if (!ipva) {
      throw new NotFoundException(`Registro de IPVA n\u00e3o encontrado.`);
    }
    return ipva;
  }

  async payInstallment(id: string, installmentNumber: number) {
    const tenantId = this.getTenantId();
    const ipva = await this.findOne(id);

    const installment = ipva.installments.find(i => i.installmentNumber === installmentNumber);
    if (!installment) {
      throw new NotFoundException(`Parcela ${installmentNumber} n\u00e3o encontrada.`);
    }

    installment.status = IpvaStatus.PAID;

    // Check if all are paid to update main status
    const allPaid = ipva.installments.every(i => i.status === IpvaStatus.PAID);
    if (allPaid) {
      ipva.status = IpvaStatus.PAID;
    }

    await ipva.save();

    // Update financial entry
    if (installment.financialEntryId) {
      await this.financialEntriesService.update(installment.financialEntryId, {
        status: FinancialEntryStatus.PAID
      });
    }

    return ipva;
  }

  async update(id: string, updateIpvaDto: UpdateIpvaDto) {
    const tenantId = this.getTenantId();
    // For simplicity, we just update the root properties. 
    // Updating installments might require synchronizing with financial entries which is complex.
    const updatedIpva = await this.ipvaModel.findOneAndUpdate(
      { _id: id, tenantId },
      updateIpvaDto,
      { new: true }
    ).exec();

    if (!updatedIpva) {
      throw new NotFoundException(`Registro de IPVA n\u00e3o encontrado.`);
    }
    return updatedIpva;
  }

  async remove(id: string) {
    const tenantId = this.getTenantId();
    const deletedIpva = await this.ipvaModel.findOneAndDelete({ _id: id, tenantId }).exec();
    if (!deletedIpva) {
      throw new NotFoundException(`Registro de IPVA n\u00e3o encontrado.`);
    }
    // Remove associated financial entries
    await this.financialEntriesService.removeBySourceId(id);
    return deletedIpva;
  }
}
