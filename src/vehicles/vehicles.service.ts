import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vehicle, VehicleDocument, VehicleStatus } from './schemas/vehicle.schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { PartialType } from '@nestjs/mapped-types';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectModel(Vehicle.name)
    private vehicleModel: Model<VehicleDocument>,
  ) {}

  private normalizeVehicleData(dto: any) {
    const data = { ...dto };
    if (data.plate && !data.licensePlate) {
      data.licensePlate = data.plate;
    }
    if (data.purchasePrice !== undefined && data.purchaseValue === undefined) {
      data.purchaseValue = data.purchasePrice;
    }
    return data;
  }

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    const normalized = this.normalizeVehicleData(createVehicleDto);
    const vehicle = new this.vehicleModel(normalized);
    return vehicle.save();
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    status?: VehicleStatus,
  ): Promise<{ data: Vehicle[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { licensePlate: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { renavam: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.vehicleModel
        .find(filter)
        .populate('currentDriverId', 'name phone email cpf')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.vehicleModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleModel
      .findById(id)
      .populate('currentDriverId', 'name phone email cpf');

    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado.`);
    }
    return vehicle;
  }

  async findByLicensePlate(plate: string): Promise<Vehicle> {
    const vehicle = await this.vehicleModel.findOne({
      licensePlate: plate.toUpperCase(),
    });
    if (!vehicle) {
      throw new NotFoundException(`Veículo com placa ${plate} não encontrado.`);
    }
    return vehicle;
  }

  async update(id: string, updateData: Partial<CreateVehicleDto>): Promise<Vehicle> {
    const normalized = this.normalizeVehicleData(updateData);
    const vehicle = await this.vehicleModel.findByIdAndUpdate(
      id,
      { $set: normalized },
      { new: true, runValidators: true },
    );

    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado.`);
    }

    return vehicle;
  }

  async updateStatus(id: string, status: VehicleStatus, driverId?: string): Promise<Vehicle> {
    const updateData: any = { status };
    if (status === VehicleStatus.RENTED && driverId) {
      updateData.currentDriverId = new Types.ObjectId(driverId);
    } else if (status !== VehicleStatus.RENTED) {
      updateData.currentDriverId = null;
    }

    return this.update(id, updateData);
  }

  async updateMileage(id: string, newMileage: number): Promise<Vehicle> {
    const vehicle = await this.vehicleModel.findByIdAndUpdate(
      id,
      { $set: { mileage: newMileage } },
      { new: true }
    );
    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado.`);
    }
    return vehicle;
  }

  async addPhoto(id: string, photoPath: string): Promise<Vehicle> {
    const vehicle = await this.vehicleModel.findByIdAndUpdate(
      id,
      { $push: { photos: photoPath } },
      { new: true },
    );
    if (!vehicle) throw new NotFoundException(`Veículo com ID ${id} não encontrado.`);
    return vehicle;
  }

  async remove(id: string): Promise<void> {
    const result = await this.vehicleModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado.`);
    }
  }

  async findWithExpiringDocuments(daysAhead = 30): Promise<Vehicle[]> {
    const limit = new Date();
    limit.setDate(limit.getDate() + daysAhead);
    const now = new Date();

    return this.vehicleModel.find({
      $or: [
        { ipvaDueDate: { $lte: limit, $gte: now } },
        { licensingDueDate: { $lte: limit, $gte: now } },
        { insuranceExpiration: { $lte: limit, $gte: now } },
      ],
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.vehicleModel.aggregate([
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.total;
      return acc;
    }, {});
  }
}
