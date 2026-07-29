import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reservation, ReservationDocument, ReservationStatus } from './schemas/reservation.schema';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { Rental, RentalDocument, RentalStatus } from '../rentals/schemas/rental.schema';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
    @InjectModel(Rental.name)
    private rentalModel: Model<RentalDocument>,
  ) {}

  async create(createReservationDto: CreateReservationDto): Promise<Reservation> {
    const { vehicleId, startDate, endDate } = createReservationDto;

    if (startDate >= endDate) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim.');
    }

    if (vehicleId) {
      // Verifica se já existe reserva para o mesmo veículo no mesmo período
      const existingReservation = await this.reservationModel.findOne({
        vehicleId,
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      });

      if (existingReservation) {
        throw new ConflictException('O veículo já está reservado para este período.');
      }

      // Verifica se o veículo já está alugado no mesmo período
      const existingRental = await this.rentalModel.findOne({
        vehicleId,
        status: { $in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] },
        startDate: { $lt: endDate },
        $or: [
          { endDate: { $gt: startDate } },
          { expectedEndDate: { $gt: startDate } },
          { endDate: null, expectedEndDate: null } // Aluguel em aberto sem data de fim
        ]
      });

      if (existingRental) {
        throw new ConflictException('O veículo já está alugado para este período.');
      }
    }

    const reservation = new this.reservationModel(createReservationDto);
    return reservation.save();
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: ReservationStatus,
  ): Promise<{ data: Reservation[]; total: number; page: number; limit: number }> {
    const filter: any = {};

    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.reservationModel
        .find(filter)
        .populate('customerId', 'name document')
        .populate('vehicleId', 'licensePlate brand model')
        .skip(skip)
        .limit(limit)
        .sort({ startDate: 1 }),
      this.reservationModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Reservation> {
    const reservation = await this.reservationModel
      .findById(id)
      .populate('customerId', 'name document')
      .populate('vehicleId', 'licensePlate brand model');

    if (!reservation) {
      throw new NotFoundException(`Reserva com ID ${id} não encontrada.`);
    }
    return reservation;
  }

  async updateStatus(id: string, updateStatusDto: UpdateReservationStatusDto): Promise<Reservation> {
    const reservation = await this.reservationModel.findByIdAndUpdate(
      id,
      { $set: { status: updateStatusDto.status } },
      { new: true, runValidators: true },
    );

    if (!reservation) {
      throw new NotFoundException(`Reserva com ID ${id} não encontrada.`);
    }

    return reservation;
  }
}
