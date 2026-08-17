import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument, DriverStatus } from './schemas/driver.schema';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver.name)
    private driverModel: Model<DriverDocument>,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const existing = await this.driverModel.findOne({
      $or: [
        { cpf: createDriverDto.cpf },
        { licenseNumber: createDriverDto.licenseNumber },
      ],
    });

    if (existing) {
      throw new ConflictException('Já existe um motorista com este CPF ou CNH cadastrado.');
    }

    const driver = new this.driverModel(createDriverDto);
    return driver.save();
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    status?: DriverStatus,
  ): Promise<{ data: Driver[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    if (status) filter.status = status;

    if (search) {
      const cleanSearch = search.replace(/\D/g, '');
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
      
      // Allow searching with or without formatting
      if (cleanSearch) {
        filter.$or.push(
          { cpf: { $regex: cleanSearch, $options: 'i' } },
          { licenseNumber: { $regex: cleanSearch, $options: 'i' } },
          { phone: { $regex: cleanSearch, $options: 'i' } }
        );
      } else {
        filter.$or.push(
          { cpf: { $regex: search, $options: 'i' } },
          { licenseNumber: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        );
      }
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.driverModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.driverModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Driver> {
    const driver = await this.driverModel.findById(id);
    if (!driver) {
      throw new NotFoundException(`Motorista com ID ${id} não encontrado.`);
    }
    return driver;
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    const driver = await this.driverModel.findByIdAndUpdate(
      id,
      { $set: updateDriverDto },
      { new: true, runValidators: true },
    );

    if (!driver) {
      throw new NotFoundException(`Motorista com ID ${id} não encontrado.`);
    }

    return driver;
  }

  async updatePhoto(id: string, photoPath: string): Promise<Driver> {
    return this.update(id, { profilePhoto: photoPath } as any);
  }

  async remove(id: string): Promise<void> {
    const result = await this.driverModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Motorista com ID ${id} não encontrado.`);
    }
  }

  async findWithExpiringLicense(daysAhead = 30): Promise<Driver[]> {
    const limit = new Date();
    limit.setDate(limit.getDate() + daysAhead);

    return this.driverModel.find({
      licenseExpiration: { $lte: limit, $gte: new Date() },
      status: DriverStatus.ACTIVE,
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.driverModel.aggregate([
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.total;
      return acc;
    }, {});
  }
}
