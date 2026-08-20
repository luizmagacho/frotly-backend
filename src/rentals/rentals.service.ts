import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  Rental,
  RentalDocument,
  RentalStatus,
  PaymentStatus,
  PaymentFrequency,
  Payment,
} from './schemas/rental.schema';
import { CreateRentalDto, RecordPaymentDto } from './dto/create-rental.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleStatus } from '../vehicles/schemas/vehicle.schema';

@Injectable()
export class RentalsService {
  constructor(
    @InjectModel(Rental.name)
    private rentalModel: Model<RentalDocument>,
    private vehiclesService: VehiclesService,
  ) {}

  private generatePaymentSchedule(
    startDate: Date,
    amount: number,
    frequency: PaymentFrequency,
    expectedEndDate?: Date,
  ): Partial<Payment>[] {
    const payments: Partial<Payment>[] = [];
    let currentDate = new Date(startDate);
    const end = expectedEndDate ? new Date(expectedEndDate) : null;

    let maxPeriods = 12; // default if no expected end date
    if (end) {
      const diffTime = Math.abs(end.getTime() - currentDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (frequency === PaymentFrequency.WEEKLY) maxPeriods = Math.max(1, Math.round(diffDays / 7));
      else if (frequency === PaymentFrequency.BIWEEKLY) maxPeriods = Math.max(1, Math.round(diffDays / 14));
      else maxPeriods = Math.max(1, Math.round(diffDays / 30));
    }

    for (let i = 0; i < maxPeriods; i++) {
      const nextDate = new Date(currentDate);
      if (frequency === PaymentFrequency.WEEKLY) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (frequency === PaymentFrequency.BIWEEKLY) {
        nextDate.setDate(nextDate.getDate() + 14);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      
      currentDate = new Date(nextDate);

      payments.push({
        dueDate: new Date(currentDate),
        amount,
        status: PaymentStatus.PENDING,
      });
    }

    return payments;
  }

  async create(createRentalDto: CreateRentalDto): Promise<Rental> {
    const vehicle = await this.vehiclesService.findById(createRentalDto.vehicleId);

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException('Este veículo não está disponível para aluguel.');
    }

    const payments = this.generatePaymentSchedule(
      createRentalDto.startDate,
      createRentalDto.rentalAmount,
      createRentalDto.paymentFrequency,
      createRentalDto.expectedEndDate,
    );

    const rental = new this.rentalModel({
      ...createRentalDto,
      vehicleId: new Types.ObjectId(createRentalDto.vehicleId),
      driverId: new Types.ObjectId(createRentalDto.driverId),
      payments,
    });

    await this.vehiclesService.updateStatus(
      createRentalDto.vehicleId,
      VehicleStatus.RENTED,
      createRentalDto.driverId,
    );

    return rental.save();
  }

  async update(id: string, updateData: any): Promise<Rental> {
    const existingRental = await this.rentalModel.findById(id);
    if (!existingRental) throw new NotFoundException(`Aluguel com ID ${id} não encontrado.`);

    let newPayments = existingRental.payments;

    if (updateData.startDate || updateData.expectedEndDate || updateData.paymentFrequency || updateData.rentalAmount) {
      const startDate = updateData.startDate || existingRental.startDate;
      const expectedEndDate = updateData.expectedEndDate || existingRental.expectedEndDate;
      const amount = updateData.rentalAmount || existingRental.rentalAmount;
      const frequency = updateData.paymentFrequency || existingRental.paymentFrequency;

      const generated = this.generatePaymentSchedule(startDate, amount, frequency, expectedEndDate);
      
      const paidPayments = existingRental.payments.filter(p => p.status !== PaymentStatus.PENDING);
      const pendingGenerated = generated.slice(paidPayments.length);
      newPayments = [...paidPayments, ...pendingGenerated] as Payment[];
    }

    const rental = await this.rentalModel.findByIdAndUpdate(
      id,
      { $set: { ...updateData, payments: newPayments } },
      { new: true }
    );
    
    if (!rental) throw new NotFoundException(`Aluguel com ID ${id} não encontrado.`);
    return rental;
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: RentalStatus,
  ): Promise<{ data: Rental[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.rentalModel
        .find(filter)
        .populate('vehicleId', 'licensePlate brand model color')
        .populate('driverId', 'name phone email cpf')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.rentalModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Rental> {
    const rental = await this.rentalModel
      .findById(id)
      .populate('vehicleId', 'licensePlate brand model color year')
      .populate('driverId', 'name phone email cpf licenseNumber');

    if (!rental) throw new NotFoundException(`Aluguel com ID ${id} não encontrado.`);
    return rental;
  }

  async findByDriver(driverId: string): Promise<Rental[]> {
    return this.rentalModel
      .find({ driverId: new Types.ObjectId(driverId) })
      .populate('vehicleId', 'licensePlate brand model color')
      .sort({ createdAt: -1 });
  }

  async findByVehicle(vehicleId: string): Promise<Rental[]> {
    return this.rentalModel
      .find({ vehicleId: new Types.ObjectId(vehicleId) })
      .populate('driverId', 'name phone email cpf')
      .sort({ createdAt: -1 });
  }

  async recordPayment(
    rentalId: string,
    recordPaymentDto: RecordPaymentDto,
  ): Promise<Rental> {
    const rental = await this.rentalModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(rentalId),
        'payments._id': new Types.ObjectId(recordPaymentDto.paymentId),
      },
      {
        $set: {
          'payments.$.status': PaymentStatus.PAID,
          'payments.$.paidAt': recordPaymentDto.paidAt,
          'payments.$.paymentMethod': recordPaymentDto.paymentMethod,
          'payments.$.notes': recordPaymentDto.notes,
        },
      },
      { new: true },
    );

    if (!rental) throw new NotFoundException('Aluguel ou pagamento não encontrado.');
    return rental;
  }

  async recordMileage(rentalId: string, mileageDto: { newMileage: number, date?: string }): Promise<Rental> {
    const rental = await this.rentalModel.findById(rentalId).populate('vehicleId');
    if (!rental) throw new NotFoundException(`Aluguel com ID ${rentalId} não encontrado.`);

    const vehicle = rental.vehicleId as any;
    
    const previousMileage = rental.mileageLogs && rental.mileageLogs.length > 0 
      ? rental.mileageLogs[rental.mileageLogs.length - 1].newMileage 
      : vehicle.mileage || vehicle.currentMileage || 0;

    const kmDriven = mileageDto.newMileage - previousMileage;

    if (kmDriven < 0) {
      throw new BadRequestException('A nova quilometragem não pode ser menor que a anterior.');
    }

    const newLog = {
      date: mileageDto.date ? new Date(mileageDto.date) : new Date(),
      previousMileage,
      newMileage: mileageDto.newMileage,
      kmDriven,
    };

    rental.mileageLogs.push(newLog as any);
    await rental.save();

    await this.vehiclesService.update(vehicle._id.toString(), {
      mileage: mileageDto.newMileage,
    } as any);

    return rental;
  }

  async terminate(id: string): Promise<Rental> {
    const rental = await this.rentalModel.findById(id);
    if (!rental) throw new NotFoundException(`Aluguel com ID ${id} não encontrado.`);

    rental.status = RentalStatus.COMPLETED;
    rental.endDate = new Date();
    await rental.save();

    await this.vehiclesService.updateStatus(
      rental.vehicleId.toString(),
      VehicleStatus.AVAILABLE,
    );

    return rental;
  }

  async findOverduePayments(): Promise<Rental[]> {
    const now = new Date();
    return this.rentalModel
      .find({
        status: RentalStatus.ACTIVE,
        payments: {
          $elemMatch: {
            status: PaymentStatus.PENDING,
            dueDate: { $lt: now },
          },
        },
      })
      .populate('vehicleId', 'licensePlate brand model')
      .populate('driverId', 'name phone email');
  }

  async getPendingPayments(): Promise<any[]> {
    return this.rentalModel.aggregate([
      { $match: { status: RentalStatus.ACTIVE } },
      { $unwind: '$payments' },
      { $match: { 'payments.status': { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } } },
      { $sort: { 'payments.dueDate': 1 } },
      {
        $lookup: {
          from: 'drivers',
          localField: 'driverId',
          foreignField: '_id',
          as: 'driver',
        },
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicle',
        },
      },
      { $unwind: '$driver' },
      { $unwind: '$vehicle' },
      {
        $project: {
          _id: 0,
          rentalId: '$_id',
          paymentId: '$payments._id',
          dueDate: '$payments.dueDate',
          amount: '$payments.amount',
          status: '$payments.status',
          driverName: '$driver.name',
          vehiclePlate: '$vehicle.licensePlate',
          vehicleModel: '$vehicle.model',
        },
      },
    ]);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkOverduePayments() {
    const now = new Date();
    
    const rentals = await this.rentalModel.find({
      status: RentalStatus.ACTIVE,
      'payments': {
        $elemMatch: {
          status: PaymentStatus.PENDING,
          dueDate: { $lt: now }
        }
      }
    }).populate('driverId', 'name');

    let totalUpdated = 0;
    for (const rental of rentals) {
      let updated = false;
      rental.payments.forEach(payment => {
        if (payment.status === PaymentStatus.PENDING && payment.dueDate < now) {
          payment.status = PaymentStatus.OVERDUE;
          updated = true;
          totalUpdated++;
        }
      });
      if (updated) {
        await rental.save();
      }
    }
    if (totalUpdated > 0) {
      console.log(`[Cron] Marcados ${totalUpdated} pagamentos como OVERDUE.`);
    }
  }

  async getFinancialSummary(): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await this.rentalModel.aggregate([
      {
        $unwind: '$payments',
      },
      {
        $facet: {
          totalReceived: [
            { $match: { 'payments.status': PaymentStatus.PAID } },
            { $group: { _id: null, total: { $sum: '$payments.amount' } } },
          ],
          receivedThisMonth: [
            {
              $match: {
                'payments.status': PaymentStatus.PAID,
                'payments.paidAt': { $gte: startOfMonth },
              },
            },
            { $group: { _id: null, total: { $sum: '$payments.amount' } } },
          ],
          pendingAmount: [
            { $match: { 'payments.status': PaymentStatus.PENDING } },
            { $group: { _id: null, total: { $sum: '$payments.amount' } } },
          ],
          overdueAmount: [
            {
              $match: {
                'payments.status': PaymentStatus.PENDING,
                'payments.dueDate': { $lt: now },
              },
            },
            { $group: { _id: null, total: { $sum: '$payments.amount' } } },
          ],
        },
      },
    ]);

    return {
      totalReceived: result[0]?.totalReceived[0]?.total ?? 0,
      receivedThisMonth: result[0]?.receivedThisMonth[0]?.total ?? 0,
      pendingAmount: result[0]?.pendingAmount[0]?.total ?? 0,
      overdueAmount: result[0]?.overdueAmount[0]?.total ?? 0,
    };
  }

  async findUpcomingPayments(daysAhead: number): Promise<Rental[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    return this.rentalModel
      .find({
        status: RentalStatus.ACTIVE,
        payments: {
          $elemMatch: {
            status: PaymentStatus.PENDING,
            dueDate: { $gte: startOfDay, $lte: endOfDay },
          },
        },
      })
      .populate('vehicleId', 'licensePlate brand model')
      .populate('driverId', 'name phone email');
  }

  async findRentalsForMonthlyMileage(): Promise<Rental[]> {
    const now = new Date();
    const currentDay = now.getDate();
    
    const activeRentals = await this.rentalModel
      .find({ status: RentalStatus.ACTIVE })
      .populate('vehicleId', 'licensePlate brand model')
      .populate('driverId', 'name phone email');

    return activeRentals.filter((rental) => {
      if (!rental.startDate) return false;
      const startDate = new Date(rental.startDate);
      
      const isSameMonthAndYear = now.getMonth() === startDate.getMonth() && now.getFullYear() === startDate.getFullYear();
      if (isSameMonthAndYear) return false;
      
      const startDay = startDate.getDate();
      if (currentDay === startDay) return true;
      
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (currentDay === lastDayOfMonth && startDay > lastDayOfMonth) {
        return true;
      }
      
      return false;
    });
  }

  async delete(id: string): Promise<any> {
    const rental = await this.rentalModel.findById(id);
    if (!rental) throw new NotFoundException(`Aluguel com ID ${id} não encontrado.`);

    if (rental.status === RentalStatus.ACTIVE) {
      await this.vehiclesService.updateStatus(
        rental.vehicleId.toString(),
        VehicleStatus.AVAILABLE,
      );
    }

    await this.rentalModel.findByIdAndDelete(id);
    return { success: true, message: 'Aluguel excluído com sucesso.' };
  }
}
