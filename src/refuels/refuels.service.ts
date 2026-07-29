import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRefuelDto } from './dto/create-refuel.dto';
import { UpdateRefuelDto } from './dto/update-refuel.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Refuel, RefuelDocument } from './schemas/refuel.schema';
import { Model } from 'mongoose';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { FinancialEntryCategory, FinancialEntryStatus, FinancialEntryType } from '../financial-entries/schemas/financial-entry.schema';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class RefuelsService {
  constructor(
    @InjectModel(Refuel.name) private refuelModel: Model<RefuelDocument>,
    private financialEntriesService: FinancialEntriesService,
    private vehiclesService: VehiclesService,
    @Inject(REQUEST) private request: Request,
  ) {}

  private getTenantId(): string {
    const tenantId = (this.request.user as any)?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is missing from request');
    }
    return tenantId;
  }

  async create(createRefuelDto: CreateRefuelDto & { paymentMethod?: string }) {
    const tenantId = this.getTenantId();
    
    // Check for mileage validation
    const lastRefuel = await this.refuelModel.findOne({
      tenantId,
      vehicleId: createRefuelDto.vehicleId
    }).sort({ date: -1 }).exec();

    if (lastRefuel && createRefuelDto.currentMileage < lastRefuel.currentMileage) {
      throw new BadRequestException('A quilometragem informada é menor que a do último abastecimento.');
    }

    const createdRefuel = new this.refuelModel({
      ...createRefuelDto,
      tenantId,
    });
    
    const savedRefuel = await createdRefuel.save();

    // Update vehicle's mileage
    try {
      await this.vehiclesService.update(createRefuelDto.vehicleId, {
        mileage: createRefuelDto.currentMileage
      });
    } catch (e) {
      console.error('Failed to update vehicle mileage:', e);
    }

    // Create financial entry
    const isPending = createRefuelDto.paymentMethod === 'fatura';
    await this.financialEntriesService.create({
      vehicleId: createRefuelDto.vehicleId,
      type: FinancialEntryType.EXPENSE,
      category: FinancialEntryCategory.COMBUSTIVEL,
      amount: createRefuelDto.totalCost,
      date: new Date(createRefuelDto.date),
      description: `Abastecimento - ${createRefuelDto.stationName || 'Posto'} - ${createRefuelDto.volume}L ${createRefuelDto.fuelType}`,
      status: isPending ? FinancialEntryStatus.PENDING : FinancialEntryStatus.PAID,
      sourceId: savedRefuel._id.toString()
    });

    return savedRefuel;
  }

  async findAll(vehicleId?: string) {
    const tenantId = this.getTenantId();
    const query: any = { tenantId };
    if (vehicleId) {
      query.vehicleId = vehicleId;
    }
    return this.refuelModel.find(query).populate('vehicleId').populate('driverId').sort({ date: -1 }).exec();
  }

  async findOne(id: string) {
    const tenantId = this.getTenantId();
    const refuel = await this.refuelModel.findOne({ _id: id, tenantId }).populate('vehicleId').populate('driverId').exec();
    if (!refuel) {
      throw new NotFoundException(`Abastecimento não encontrado`);
    }
    return refuel;
  }

  async update(id: string, updateRefuelDto: UpdateRefuelDto) {
    const tenantId = this.getTenantId();
    const updatedRefuel = await this.refuelModel.findOneAndUpdate(
      { _id: id, tenantId },
      updateRefuelDto,
      { new: true }
    ).exec();
    
    if (!updatedRefuel) {
      throw new NotFoundException(`Abastecimento não encontrado`);
    }
    return updatedRefuel;
  }

  async remove(id: string) {
    const tenantId = this.getTenantId();
    const deletedRefuel = await this.refuelModel.findOneAndDelete({ _id: id, tenantId }).exec();
    if (!deletedRefuel) {
      throw new NotFoundException(`Abastecimento não encontrado`);
    }
    // Also delete associated financial entry
    await this.financialEntriesService.removeBySourceId(id);
    return deletedRefuel;
  }
}
