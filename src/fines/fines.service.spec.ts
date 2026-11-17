import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FinesService } from './fines.service';
import { DriverChargeStatus, Fine, FineStatus } from './schemas/fine.schema';
import { Rental } from '../rentals/schemas/rental.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';

const VEHICLE_ID = new Types.ObjectId().toString();
const DRIVER_ID = new Types.ObjectId();
const RENTAL_ID = new Types.ObjectId();

/** Encadeamento find().populate().populate().sort().skip().limit().lean() */
function chain(result: any) {
  const q: any = {};
  for (const m of ['populate', 'sort', 'skip', 'limit']) q[m] = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
}

describe('FinesService', () => {
  let service: FinesService;
  let saved: any[];
  let fineModel: any;
  let rentalModel: { findOne: jest.Mock };
  let financial: { upsertBySourceId: jest.Mock; removeBySourceId: jest.Mock };

  beforeEach(async () => {
    saved = [];
    // Model como construtor: `new fineModel(data)` devolve um doc com save().
    fineModel = jest.fn().mockImplementation((data: any) => {
      const doc: any = { _id: new Types.ObjectId(), tenantId: new Types.ObjectId(), ...data };
      doc.save = jest.fn().mockImplementation(async () => { saved.push(doc); return doc; });
      return doc;
    });
    fineModel.find = jest.fn();
    fineModel.findById = jest.fn();
    fineModel.countDocuments = jest.fn().mockResolvedValue(0);

    rentalModel = { findOne: jest.fn().mockReturnValue(chain(null)) };
    financial = { upsertBySourceId: jest.fn().mockResolvedValue({}), removeBySourceId: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinesService,
        { provide: getModelToken(Fine.name), useValue: fineModel },
        { provide: getModelToken(Rental.name), useValue: rentalModel },
        { provide: FinancialEntriesService, useValue: financial },
      ],
    }).compile();

    service = module.get(FinesService);
    // findOne() no fim do create/update só relê o doc; aqui devolve o último salvo.
    fineModel.findById.mockImplementation(() => chain(saved[saved.length - 1]));
  });

  const baseDto = {
    vehicleId: VEHICLE_ID,
    noticeNumber: 'AIT-123',
    infractionDate: '2026-10-10T12:00:00.000Z',
    description: 'Excesso de velocidade até 20%',
    value: 130.16,
  };

  describe('findResponsibleDriver', () => {
    it('returns the driver of the rental active on the infraction date', async () => {
      rentalModel.findOne.mockReturnValue(chain({ _id: RENTAL_ID, driverId: { _id: DRIVER_ID, name: 'Ana Silva' } }));

      const result = await service.findResponsibleDriver(VEHICLE_ID, '2026-10-10');

      expect(result).toEqual({ driverId: DRIVER_ID.toString(), name: 'Ana Silva', rentalId: RENTAL_ID.toString() });
      const filter = rentalModel.findOne.mock.calls[0][0];
      expect(filter.vehicleId.toString()).toBe(VEHICLE_ID);
      expect(filter.startDate.$lte).toEqual(new Date('2026-10-10'));
    });

    it('returns null for an invalid vehicle id or date without querying', async () => {
      expect(await service.findResponsibleDriver('nope', '2026-10-10')).toBeNull();
      expect(await service.findResponsibleDriver(VEHICLE_ID, 'not-a-date')).toBeNull();
      expect(rentalModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('fills the driver from the rental when not informed and books a pending expense', async () => {
      rentalModel.findOne.mockReturnValue(chain({ _id: RENTAL_ID, driverId: { _id: DRIVER_ID, name: 'Ana Silva' } }));

      await service.create(baseDto as any);

      const doc = saved[0];
      expect(doc.driverId.toString()).toBe(DRIVER_ID.toString());
      expect(doc.status).toBe(FineStatus.PENDING);
      expect(doc.driverChargeRef).toBeUndefined();
      expect(financial.upsertBySourceId).toHaveBeenCalledTimes(1);
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc._id.toString(), expect.objectContaining({
        type: 'EXPENSE', category: 'MULTA', amount: 130.16, status: 'PENDING', vehicleId: VEHICLE_ID,
      }));
    });

    it('keeps an explicitly chosen driver and does not look up the rental', async () => {
      const chosen = new Types.ObjectId().toString();
      await service.create({ ...baseDto, driverId: chosen } as any);
      expect(saved[0].driverId.toString()).toBe(chosen);
      expect(rentalModel.findOne).not.toHaveBeenCalled();
    });

    it('books the charge to the driver as income under its own source key', async () => {
      await service.create({ ...baseDto, chargeToDriver: true } as any);

      const doc = saved[0];
      expect(doc.driverChargeRef).toBeInstanceOf(Types.ObjectId);
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc.driverChargeRef.toString(), expect.objectContaining({
        type: 'INCOME', category: 'MULTA', amount: 130.16, status: 'PENDING',
      }));
    });

    it('marks paidAt and a paid expense when created already paid', async () => {
      await service.create({ ...baseDto, status: FineStatus.PAID } as any);
      expect(saved[0].paidAt).toBeInstanceOf(Date);
      expect(financial.upsertBySourceId.mock.calls[0][1].status).toBe('PAID');
    });
  });

  describe('status changes', () => {
    function existing(overrides: any = {}) {
      const doc: any = {
        _id: new Types.ObjectId(), tenantId: new Types.ObjectId(), vehicleId: new Types.ObjectId(VEHICLE_ID),
        noticeNumber: 'AIT-9', description: 'Estacionar em local proibido', value: 195.23,
        infractionDate: new Date('2026-09-01'), status: FineStatus.PENDING, chargeToDriver: false,
        driverChargeStatus: DriverChargeStatus.PENDING, ...overrides,
      };
      doc.save = jest.fn().mockImplementation(async () => { saved.push(doc); return doc; });
      doc.deleteOne = jest.fn().mockResolvedValue(undefined);
      fineModel.findById.mockImplementation(() => {
        const q: any = Promise.resolve(doc);
        Object.assign(q, chain(doc));
        return q;
      });
      return doc;
    }

    it('markAsPaid sets PAID, paidAt and a paid expense', async () => {
      const doc = existing();
      await service.markAsPaid(doc._id.toString());
      expect(doc.status).toBe(FineStatus.PAID);
      expect(doc.paidAt).toBeInstanceOf(Date);
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc._id.toString(), expect.objectContaining({ status: 'PAID' }));
    });

    it('cancelling a fine (appeal granted) removes its financial entries', async () => {
      const ref = new Types.ObjectId();
      const doc = existing({ chargeToDriver: true, driverChargeRef: ref });
      await service.update(doc._id.toString(), { status: FineStatus.CANCELLED });
      expect(financial.upsertBySourceId).not.toHaveBeenCalled();
      expect(financial.removeBySourceId).toHaveBeenCalledWith(doc._id.toString());
      expect(financial.removeBySourceId).toHaveBeenCalledWith(ref.toString());
    });

    it('turning off the charge to the driver removes the income entry', async () => {
      const ref = new Types.ObjectId();
      const doc = existing({ chargeToDriver: true, driverChargeRef: ref });
      await service.update(doc._id.toString(), { chargeToDriver: false });
      expect(financial.removeBySourceId).toHaveBeenCalledWith(ref.toString());
      expect(financial.upsertBySourceId).toHaveBeenCalledTimes(1); // só a despesa
    });

    it('markDriverChargePaid books the income as paid', async () => {
      const doc = existing({ chargeToDriver: true, driverChargeRef: new Types.ObjectId() });
      await service.markDriverChargePaid(doc._id.toString());
      expect(doc.driverChargeStatus).toBe(DriverChargeStatus.PAID);
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc.driverChargeRef.toString(), expect.objectContaining({
        type: 'INCOME', status: 'PAID',
      }));
    });

    it('remove deletes the fine and both financial entries', async () => {
      const ref = new Types.ObjectId();
      const doc = existing({ driverChargeRef: ref });
      await service.remove(doc._id.toString());
      expect(doc.deleteOne).toHaveBeenCalled();
      expect(financial.removeBySourceId).toHaveBeenCalledWith(doc._id.toString());
      expect(financial.removeBySourceId).toHaveBeenCalledWith(ref.toString());
    });

    it('throws NotFound for an unknown or invalid id', async () => {
      fineModel.findById.mockResolvedValue(null);
      await expect(service.markAsPaid(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('translates OVERDUE into pending fines past their due date and paginates', async () => {
      const q = chain([]);
      fineModel.find.mockReturnValue(q);

      const result = await service.findAll({ status: 'OVERDUE', page: 2, limit: 10 });

      const filter = fineModel.find.mock.calls[0][0];
      expect(filter.status).toBe(FineStatus.PENDING);
      expect(filter.dueDate.$lt).toBeInstanceOf(Date);
      expect(q.skip).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
    });

    it('escapes regex characters in the search term', async () => {
      fineModel.find.mockReturnValue(chain([]));
      await service.findAll({ search: 'AIT.1*' });
      const rx: RegExp = fineModel.find.mock.calls[0][0].$or[0].noticeNumber;
      expect(rx.test('AIT.1*')).toBe(true);
      expect(rx.test('AITx11')).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('splits totals into pending, overdue, appealed, paid this year and to charge from drivers', async () => {
      const past = new Date(Date.now() - 5 * 86400000);
      const future = new Date(Date.now() + 5 * 86400000);
      fineModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
        { status: 'PENDING', value: 100, dueDate: past, chargeToDriver: true, driverChargeStatus: 'PENDING' },
        { status: 'PENDING', value: 50.5, dueDate: future },
        { status: 'APPEALED', value: 200 },
        { status: 'PAID', value: 80, paidAt: new Date(), chargeToDriver: true, driverChargeStatus: 'PAID' },
        { status: 'CANCELLED', value: 300, chargeToDriver: true, driverChargeStatus: 'PENDING' },
      ]) });

      const s = await service.getSummary();

      expect(s.pending).toEqual({ count: 2, value: 150.5 });
      expect(s.overdue).toEqual({ count: 1, value: 100 });
      expect(s.appealed).toEqual({ count: 1, value: 200 });
      expect(s.paidThisYear).toEqual({ count: 1, value: 80 });
      expect(s.toChargeFromDrivers).toEqual({ count: 1, value: 100 });
    });
  });
});
