import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inspection, InspectionDocument, InspectionType } from './schemas/inspection.schema';
import { CreateInspectionDto } from './dto/create-inspection.dto';

export interface InspectionQuery {
  rentalId?: string;
  vehicleId?: string;
  type?: InspectionType;
}

@Injectable()
export class InspectionsService {
  constructor(
    @InjectModel(Inspection.name)
    private inspectionModel: Model<InspectionDocument>,
  ) {}

  async create(createInspectionDto: CreateInspectionDto & { tenantId: string }): Promise<Inspection> {
    const inspection = new this.inspectionModel({
      ...createInspectionDto,
      tenantId: new Types.ObjectId(createInspectionDto.tenantId),
      rentalId: new Types.ObjectId(createInspectionDto.rentalId),
      vehicleId: new Types.ObjectId(createInspectionDto.vehicleId),
      driverId: new Types.ObjectId(createInspectionDto.driverId),
    });
    return inspection.save();
  }

  async findAll(
    query: InspectionQuery = {},
  ): Promise<Inspection[]> {
    const filter: any = {};

    if (query.rentalId) filter.rentalId = new Types.ObjectId(query.rentalId);
    if (query.vehicleId) filter.vehicleId = new Types.ObjectId(query.vehicleId);
    if (query.type) filter.type = query.type;

    return this.inspectionModel
      .find(filter)
      .populate('rentalId', '_id')
      .populate('vehicleId', 'plate model brand')
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<Inspection> {
    const inspection = await this.inspectionModel
      .findById(id)
      .populate('rentalId', '_id')
      .populate('vehicleId', 'plate model brand')
      .populate('driverId', 'name phone');

    if (!inspection) {
      throw new NotFoundException(`Vistoria com ID ${id} não encontrada.`);
    }

    return inspection;
  }
}
