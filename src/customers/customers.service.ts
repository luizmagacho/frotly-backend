import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument, CustomerStatus } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    try {
      const customer = new this.customerModel(createCustomerDto);
      return await customer.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Já existe um cliente com este documento.');
      }
      throw error;
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    status?: CustomerStatus,
  ): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { document: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.customerModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customerModel.findById(id);
    if (!customer) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    try {
      const customer = await this.customerModel.findByIdAndUpdate(
        id,
        { $set: updateCustomerDto },
        { new: true, runValidators: true },
      );

      if (!customer) {
        throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
      }

      return customer;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Já existe um cliente com este documento.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.customerModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }
  }
}
