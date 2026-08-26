import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CreateMileageDto } from './dto/create-mileage.dto';
import { Mileage, MileageDocument, MileageSource } from './schemas/mileage.schema';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class MileageService {
  constructor(
    @InjectModel(Mileage.name) private mileageModel: Model<MileageDocument>,
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

  async create(dto: CreateMileageDto, source: MileageSource = MileageSource.MANUAL) {
    const tenantId = this.getTenantId();

    const lastReading = await this.mileageModel
      .findOne({ tenantId: new Types.ObjectId(tenantId), vehicleId: new Types.ObjectId(dto.vehicleId) })
      .sort({ mileage: -1 })
      .exec();

    if (lastReading && dto.mileage < lastReading.mileage) {
      throw new BadRequestException('A quilometragem informada é menor que o último registro.');
    }

    const created = new this.mileageModel({
      ...dto,
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: new Types.ObjectId(dto.vehicleId),
      source,
    });
    const saved = await created.save();

    try {
      await this.vehiclesService.update(dto.vehicleId, { mileage: dto.mileage });
    } catch (e) {
      console.error('Failed to update vehicle mileage:', e);
    }

    return saved;
  }

  async findAll(vehicleId?: string) {
    const tenantId = this.getTenantId();
    const query: any = { tenantId: new Types.ObjectId(tenantId) };
    if (vehicleId) {
      query.vehicleId = new Types.ObjectId(vehicleId);
    }
    return this.mileageModel.find(query).populate('vehicleId', 'licensePlate brand model').sort({ date: -1 }).exec();
  }

  async findOne(id: string) {
    const tenantId = this.getTenantId();
    const reading = await this.mileageModel.findOne({ _id: id, tenantId: new Types.ObjectId(tenantId) }).populate('vehicleId').exec();
    if (!reading) throw new NotFoundException('Registro de quilometragem não encontrado');
    return reading;
  }

  async remove(id: string) {
    const tenantId = this.getTenantId();
    const deleted = await this.mileageModel.findOneAndDelete({ _id: id, tenantId: new Types.ObjectId(tenantId) }).exec();
    if (!deleted) throw new NotFoundException('Registro de quilometragem não encontrado');
    return deleted;
  }
}
