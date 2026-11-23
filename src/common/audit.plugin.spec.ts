import { Types } from 'mongoose';
import { diffDocs, labelOf, summarize } from './audit.plugin';

describe('auditPlugin helpers', () => {
  it('diffDocs lista só os campos que mudaram, sem campos técnicos ou sensíveis', () => {
    const id = new Types.ObjectId();
    const before = { _id: id, licensePlate: 'ABC1D23', color: 'Preto', mileage: 1000, updatedAt: new Date(1), password: 'x' };
    const after = { _id: id, licensePlate: 'ABC1D23', color: 'Branco', mileage: 1200, updatedAt: new Date(2), password: 'y' };
    expect(diffDocs(before, after)).toEqual([
      { field: 'color', from: 'Preto', to: 'Branco' },
      { field: 'mileage', from: 1000, to: 1200 },
    ]);
  });

  it('trata ObjectId e datas iguais como iguais e vazio/ausente como sem mudança', () => {
    const v = new Types.ObjectId();
    expect(diffDocs({ vehicleId: v, notes: '' }, { vehicleId: new Types.ObjectId(v.toHexString()) })).toEqual([]);
    expect(diffDocs({ dueDate: new Date('2026-01-01') }, { dueDate: new Date('2026-01-01') })).toEqual([]);
  });

  it('campo novo e campo removido aparecem', () => {
    expect(diffDocs({ a: 1 }, { b: 2 })).toEqual([
      { field: 'a', from: 1, to: null },
      { field: 'b', from: null, to: 2 },
    ]);
  });

  it('summarize corta valores grandes', () => {
    expect((summarize('x'.repeat(500)) as string).length).toBeLessThanOrEqual(301);
    expect(typeof summarize({ photos: Array(100).fill('https://exemplo.com/foto.jpg') })).toBe('string');
  });

  it('labelOf usa placa, nome ou descrição', () => {
    expect(labelOf({ licensePlate: 'FRT1A23', name: 'Onix' })).toBe('FRT1A23');
    expect(labelOf({ description: 'Troca de óleo' })).toBe('Troca de óleo');
    expect(labelOf({})).toBeUndefined();
  });
});
