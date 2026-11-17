import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriverChargeStatus, Fine, FineDocument, FineStatus } from './schemas/fine.schema';
import { CreateFineDto } from './dto/create-fine.dto';
import { UpdateFineDto } from './dto/update-fine.dto';
import { Rental, RentalDocument, RentalStatus } from '../rentals/schemas/rental.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import {
  FinancialEntryCategory,
  FinancialEntryStatus,
  FinancialEntryType,
} from '../financial-entries/schemas/financial-entry.schema';

export type FineListStatus = FineStatus | 'OVERDUE';

export interface FineQuery {
  page?: number;
  limit?: number;
  status?: FineListStatus;
  vehicleId?: string;
  driverId?: string;
  search?: string;
}

export interface ResponsibleDriver {
  driverId: string;
  name: string;
  rentalId: string;
}

const VEHICLE_FIELDS = 'licensePlate brand model';
const DRIVER_FIELDS = 'name phone';

/**
 * Multas da frota. Todas as consultas são escopadas por tenant pelo tenantPlugin
 * (a partir do contexto da requisição), como nos demais módulos.
 *
 * Cada multa mantém o financeiro em dia:
 *  - despesa MULTA do veículo (sourceId = _id da multa), paga ou pendente;
 *  - se repassada ao motorista, receita MULTA (sourceId = driverChargeRef).
 * Multa cancelada (recurso deferido) sai do financeiro.
 */
@Injectable()
export class FinesService {
  constructor(
    @InjectModel(Fine.name) private fineModel: Model<FineDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    private financialEntriesService: FinancialEntriesService,
  ) {}

  /** Motorista que estava com o veículo na data informada (pelo contrato de aluguel). */
  async findResponsibleDriver(vehicleId: string, date: Date | string): Promise<ResponsibleDriver | null> {
    if (!Types.ObjectId.isValid(vehicleId)) return null;
    const when = new Date(date);
    if (isNaN(when.getTime())) return null;

    const rental = await this.rentalModel
      .findOne({
        vehicleId: new Types.ObjectId(vehicleId),
        startDate: { $lte: when },
        $or: [
          { endDate: { $gte: when } },
          { endDate: null, status: { $in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] } },
          { endDate: null, expectedEndDate: { $gte: when } },
        ],
      })
      .sort({ startDate: -1 })
      .populate('driverId', 'name')
      .lean();

    const driver = rental?.driverId as any;
    if (!rental || !driver?._id) return null;
    return { driverId: driver._id.toString(), name: driver.name, rentalId: rental._id.toString() };
  }

  async create(dto: CreateFineDto): Promise<Fine> {
    let driverId = dto.driverId;
    if (!driverId) {
      driverId = (await this.findResponsibleDriver(dto.vehicleId, dto.infractionDate))?.driverId;
    }

    const status = dto.status ?? FineStatus.PENDING;
    const fine = new this.fineModel({
      ...dto,
      vehicleId: new Types.ObjectId(dto.vehicleId),
      driverId: driverId ? new Types.ObjectId(driverId) : undefined,
      status,
      paidAt: status === FineStatus.PAID ? new Date() : undefined,
      driverChargeRef: dto.chargeToDriver ? new Types.ObjectId() : undefined,
    });

    const saved = await fine.save();
    await this.syncFinancial(saved);
    return this.findOne(saved._id.toString());
  }

  async findAll(query: FineQuery = {}) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 20));
    const filter: any = {};

    if (query.status === 'OVERDUE') {
      filter.status = FineStatus.PENDING;
      filter.dueDate = { $lt: new Date() };
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.vehicleId && Types.ObjectId.isValid(query.vehicleId)) filter.vehicleId = new Types.ObjectId(query.vehicleId);
    if (query.driverId && Types.ObjectId.isValid(query.driverId)) filter.driverId = new Types.ObjectId(query.driverId);
    if (query.search?.trim()) {
      const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ noticeNumber: rx }, { description: rx }, { location: rx }, { infractionCode: rx }];
    }

    const [data, total] = await Promise.all([
      this.fineModel
        .find(filter)
        .populate('vehicleId', VEHICLE_FIELDS)
        .populate('driverId', DRIVER_FIELDS)
        .sort({ infractionDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.fineModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getSummary() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const fines = await this.fineModel
      .find({}, 'status value dueDate paidAt chargeToDriver driverChargeStatus points')
      .lean();

    const sum = (list: any[]) => Math.round(list.reduce((s, f) => s + (f.value || 0), 0) * 100) / 100;
    const pending = fines.filter((f) => f.status === FineStatus.PENDING);
    const overdue = pending.filter((f) => f.dueDate && new Date(f.dueDate) < now);
    const appealed = fines.filter((f) => f.status === FineStatus.APPEALED);
    const paidThisYear = fines.filter((f) => f.status === FineStatus.PAID && f.paidAt && new Date(f.paidAt) >= startOfYear);
    const toCharge = fines.filter(
      (f) => f.chargeToDriver && f.driverChargeStatus !== DriverChargeStatus.PAID && f.status !== FineStatus.CANCELLED,
    );

    return {
      pending: { count: pending.length, value: sum(pending) },
      overdue: { count: overdue.length, value: sum(overdue) },
      appealed: { count: appealed.length, value: sum(appealed) },
      paidThisYear: { count: paidThisYear.length, value: sum(paidThisYear) },
      toChargeFromDrivers: { count: toCharge.length, value: sum(toCharge) },
    };
  }

  async findOne(id: string): Promise<Fine> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Multa não encontrada.');
    const fine = await this.fineModel
      .findById(id)
      .populate('vehicleId', VEHICLE_FIELDS)
      .populate('driverId', DRIVER_FIELDS)
      .lean();
    if (!fine) throw new NotFoundException('Multa não encontrada.');
    return fine as Fine;
  }

  async update(id: string, dto: UpdateFineDto): Promise<Fine> {
    const fine = await this.getDoc(id);

    const { vehicleId, driverId, ...rest } = dto;
    Object.assign(fine, rest);
    if (vehicleId) fine.vehicleId = new Types.ObjectId(vehicleId);

    if (driverId) {
      fine.driverId = new Types.ObjectId(driverId);
    } else if ((vehicleId || dto.infractionDate) && driverId === undefined) {
      // Veículo ou data mudaram e ninguém escolheu o motorista: recalcula pelo contrato.
      const responsible = await this.findResponsibleDriver(fine.vehicleId.toString(), fine.infractionDate);
      fine.driverId = responsible ? new Types.ObjectId(responsible.driverId) : undefined;
    }

    if (dto.status === FineStatus.PAID && !fine.paidAt) fine.paidAt = new Date();
    if (dto.status && dto.status !== FineStatus.PAID) fine.paidAt = undefined;
    if (fine.chargeToDriver && !fine.driverChargeRef) fine.driverChargeRef = new Types.ObjectId();

    await fine.save();
    await this.syncFinancial(fine);
    return this.findOne(id);
  }

  async markAsPaid(id: string, paidAt?: string): Promise<Fine> {
    const fine = await this.getDoc(id);
    fine.status = FineStatus.PAID;
    fine.paidAt = paidAt ? new Date(paidAt) : new Date();
    await fine.save();
    await this.syncFinancial(fine);
    return this.findOne(id);
  }

  async markDriverChargePaid(id: string): Promise<Fine> {
    const fine = await this.getDoc(id);
    fine.chargeToDriver = true;
    fine.driverChargeStatus = DriverChargeStatus.PAID;
    if (!fine.driverChargeRef) fine.driverChargeRef = new Types.ObjectId();
    await fine.save();
    await this.syncFinancial(fine);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const fine = await this.getDoc(id);
    await this.financialEntriesService.removeBySourceId(fine._id.toString());
    if (fine.driverChargeRef) await this.financialEntriesService.removeBySourceId(fine.driverChargeRef.toString());
    await fine.deleteOne();
  }

  private async getDoc(id: string): Promise<FineDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Multa não encontrada.');
    const fine = await this.fineModel.findById(id);
    if (!fine) throw new NotFoundException('Multa não encontrada.');
    return fine;
  }

  private async syncFinancial(fine: FineDocument): Promise<void> {
    const sourceId = fine._id.toString();
    const chargeRef = fine.driverChargeRef?.toString();
    const vehicleId = fine.vehicleId.toString();

    if (fine.status === FineStatus.CANCELLED || !(fine.value > 0)) {
      await this.financialEntriesService.removeBySourceId(sourceId);
      if (chargeRef) await this.financialEntriesService.removeBySourceId(chargeRef);
      return;
    }

    await this.financialEntriesService.upsertBySourceId(sourceId, {
      tenantId: fine.tenantId,
      vehicleId,
      type: FinancialEntryType.EXPENSE,
      category: FinancialEntryCategory.MULTA,
      amount: fine.value,
      date: fine.paidAt || fine.dueDate || fine.infractionDate,
      description: `Multa ${fine.noticeNumber} — ${fine.description}`,
      status: fine.status === FineStatus.PAID ? FinancialEntryStatus.PAID : FinancialEntryStatus.PENDING,
    });

    if (!chargeRef) return;
    if (fine.chargeToDriver) {
      await this.financialEntriesService.upsertBySourceId(chargeRef, {
        tenantId: fine.tenantId,
        vehicleId,
        type: FinancialEntryType.INCOME,
        category: FinancialEntryCategory.MULTA,
        amount: fine.value,
        date: fine.infractionDate,
        description: `Repasse ao motorista — multa ${fine.noticeNumber}`,
        status: fine.driverChargeStatus === DriverChargeStatus.PAID ? FinancialEntryStatus.PAID : FinancialEntryStatus.PENDING,
      });
    } else {
      await this.financialEntriesService.removeBySourceId(chargeRef);
    }
  }
}
