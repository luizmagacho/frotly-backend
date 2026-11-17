import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LicensingService } from './licensing.service';
import { Licensing, LicensingStatus } from './schemas/licensing.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';

const TENANT = new Types.ObjectId().toString();
const VEHICLE = new Types.ObjectId().toString();

function chain(result: any) {
  const q: any = { populate: jest.fn(), exec: jest.fn().mockResolvedValue(result) };
  q.populate.mockReturnValue(q);
  return q;
}

describe('LicensingService', () => {
  let service: LicensingService;
  let model: any;
  let financial: { upsertBySourceId: jest.Mock; removeBySourceId: jest.Mock };
  let docs: any[];

  const makeDoc = (data: any) => {
    const doc: any = { _id: new Types.ObjectId(), ...data };
    doc.save = jest.fn().mockImplementation(async () => doc);
    return doc;
  };

  beforeEach(async () => {
    docs = [];
    model = jest.fn().mockImplementation((data: any) => {
      const d = makeDoc(data);
      docs.push(d);
      return d;
    });
    model.exists = jest.fn().mockResolvedValue(null);
    model.findOne = jest.fn();
    model.findOneAndDelete = jest.fn();
    model.find = jest.fn();
    financial = { upsertBySourceId: jest.fn().mockResolvedValue({}), removeBySourceId: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensingService,
        { provide: getModelToken(Licensing.name), useValue: model },
        { provide: FinancialEntriesService, useValue: financial },
      ],
    }).compile();
    service = module.get(LicensingService);
  });

  const dto = { vehicleId: VEHICLE, year: 2026, value: 155.23, dueDate: '2026-09-30T12:00:00.000Z' };

  it('creates a pending licensing and books a pending expense keyed by its id', async () => {
    await service.create(TENANT, dto as any);
    const doc = docs[0];
    expect(doc.status).toBe(LicensingStatus.PENDING);
    expect(doc.paidAt).toBeUndefined();
    expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc._id.toString(), expect.objectContaining({
      type: 'EXPENSE', category: 'LICENCIAMENTO', amount: 155.23, status: 'PENDING', vehicleId: VEHICLE,
    }));
  });

  it('sets paidAt and a paid expense when created already paid', async () => {
    await service.create(TENANT, { ...dto, status: LicensingStatus.PAID } as any);
    expect(docs[0].paidAt).toBeInstanceOf(Date);
    expect(financial.upsertBySourceId.mock.calls[0][1].status).toBe('PAID');
  });

  it('rejects a second licensing for the same vehicle and year', async () => {
    model.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(service.create(TENANT, dto as any)).rejects.toThrow(ConflictException);
    expect(financial.upsertBySourceId).not.toHaveBeenCalled();
  });

  describe('existing record', () => {
    let doc: any;
    beforeEach(() => {
      doc = makeDoc({
        tenantId: new Types.ObjectId(TENANT), vehicleId: new Types.ObjectId(VEHICLE), year: 2026, value: 155.23,
        dueDate: new Date('2026-09-30'), status: LicensingStatus.PENDING,
      });
      model.findOne.mockImplementation(() => chain(doc));
    });

    it('markAsPaid updates status, paidAt and the financial entry (no duplicate)', async () => {
      await service.markAsPaid(TENANT, doc._id.toString());
      expect(doc.status).toBe(LicensingStatus.PAID);
      expect(doc.paidAt).toBeInstanceOf(Date);
      expect(financial.upsertBySourceId).toHaveBeenCalledTimes(1);
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc._id.toString(), expect.objectContaining({ status: 'PAID' }));
    });

    it('update syncs a new value to the financial entry', async () => {
      await service.update(TENANT, doc._id.toString(), { value: 160 });
      expect(financial.upsertBySourceId).toHaveBeenCalledWith(doc._id.toString(), expect.objectContaining({ amount: 160 }));
    });

    it('update only checks uniqueness when vehicle or year changes', async () => {
      await service.update(TENANT, doc._id.toString(), { value: 160 });
      expect(model.exists).not.toHaveBeenCalled();
      await service.update(TENANT, doc._id.toString(), { year: 2027 });
      expect(model.exists).toHaveBeenCalledWith(expect.objectContaining({ year: 2027, _id: { $ne: doc._id } }));
    });

    it('moving back from PAID clears paidAt', async () => {
      doc.status = LicensingStatus.PAID;
      doc.paidAt = new Date();
      await service.update(TENANT, doc._id.toString(), { status: LicensingStatus.PENDING });
      expect(doc.paidAt).toBeUndefined();
      expect(financial.upsertBySourceId.mock.calls[0][1].status).toBe('PENDING');
    });
  });

  it('remove deletes the record and its financial entry', async () => {
    const id = new Types.ObjectId();
    model.findOneAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: id }) });
    await service.remove(TENANT, id.toString());
    expect(financial.removeBySourceId).toHaveBeenCalledWith(id.toString());
  });

  it('throws NotFound for invalid or unknown ids', async () => {
    await expect(service.markAsPaid(TENANT, 'invalid')).rejects.toThrow(NotFoundException);
    model.findOne.mockImplementation(() => chain(null));
    await expect(service.update(TENANT, new Types.ObjectId().toString(), { value: 1 })).rejects.toThrow(NotFoundException);
  });
});
