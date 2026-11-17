import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FinancialEntriesService } from './financial-entries.service';
import { FinancialEntry } from './schemas/financial-entry.schema';
import { Maintenance } from '../maintenances/schemas/maintenance.schema';
import { Rental } from '../rentals/schemas/rental.schema';

/**
 * Os campos de referência do schema são Mixed: o Mongoose não converte texto em ObjectId.
 * Estes testes garantem que o serviço converte, senão o tenantPlugin (que filtra por
 * ObjectId) deixa de enxergar o lançamento e o upsert por sourceId duplica.
 */
describe('FinancialEntriesService — reference normalization', () => {
  let service: FinancialEntriesService;
  let created: any[];
  let model: any;

  beforeEach(async () => {
    created = [];
    model = jest.fn().mockImplementation((data: any) => ({ ...data, save: jest.fn().mockImplementation(async function (this: any) { created.push(data); return data; }) }));
    model.findOne = jest.fn().mockResolvedValue(null);
    model.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    model.deleteMany = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialEntriesService,
        { provide: getModelToken(FinancialEntry.name), useValue: model },
        { provide: getModelToken(Maintenance.name), useValue: {} },
        { provide: getModelToken(Rental.name), useValue: {} },
      ],
    }).compile();
    service = module.get(FinancialEntriesService);
  });

  const tenantId = new Types.ObjectId().toString();
  const vehicleId = new Types.ObjectId().toString();
  const base = { tenantId, vehicleId, type: 'EXPENSE', category: 'SEGURO', amount: 10 };

  it('create converts string tenantId/vehicleId to ObjectId', async () => {
    await service.create(base as any);
    expect(created[0].tenantId).toBeInstanceOf(Types.ObjectId);
    expect(created[0].tenantId.toString()).toBe(tenantId);
    expect(created[0].vehicleId).toBeInstanceOf(Types.ObjectId);
  });

  it('upsertBySourceId looks up by string sourceId and inserts normalized refs', async () => {
    const sourceId = new Types.ObjectId();
    await service.upsertBySourceId(sourceId as any, base);
    expect(model.findOne).toHaveBeenCalledWith({ sourceId: sourceId.toString() });
    expect(created[0].sourceId).toBe(sourceId.toString());
    expect(created[0].tenantId).toBeInstanceOf(Types.ObjectId);
  });

  it('upsertBySourceId updates the existing entry with normalized refs instead of inserting', async () => {
    const existingId = new Types.ObjectId();
    model.findOne.mockResolvedValue({ _id: existingId });
    await service.upsertBySourceId('abc', { ...base, amount: 20 });
    expect(created).toHaveLength(0);
    const [id, update] = model.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe(existingId);
    expect(update.$set.tenantId).toBeInstanceOf(Types.ObjectId);
    expect(update.$set.amount).toBe(20);
  });

  it('keeps an ObjectId tenantId as is', async () => {
    const oid = new Types.ObjectId();
    await service.create({ ...base, tenantId: oid } as any);
    expect(created[0].tenantId).toBe(oid);
  });

  it('removeBySourceId matches the string form', async () => {
    const sourceId = new Types.ObjectId();
    await service.removeBySourceId(sourceId as any);
    expect(model.deleteMany).toHaveBeenCalledWith({ sourceId: sourceId.toString() });
  });
});
