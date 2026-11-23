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

  it('em listas de registros (pagamentos) mostra só o item e o campo que mudaram', () => {
    const p1 = new Types.ObjectId();
    const p2 = new Types.ObjectId();
    const p3 = new Types.ObjectId();
    const due = new Date('2026-05-14T06:00:00Z');
    const before = { payments: [
      { _id: p1, dueDate: new Date('2026-05-07T06:00:00Z'), amount: 689, status: 'PAID' },
      { _id: p2, dueDate: due, amount: 689, status: 'PENDING' },
      { _id: p3, dueDate: new Date('2026-05-21T06:00:00Z'), amount: 689, status: 'PENDING' },
    ] };
    const after = { payments: [
      { _id: p1, dueDate: new Date('2026-05-07T06:00:00Z'), amount: 689, status: 'PAID' },
      { _id: p2, dueDate: due, amount: 689, status: 'PAID', paymentMethod: 'PIX' },
      { _id: new Types.ObjectId(), dueDate: new Date('2026-05-28T06:00:00Z'), amount: 700, status: 'PENDING' },
    ] };
    const changes = diffDocs(before, after);
    expect(changes).toEqual([
      { field: 'payments', sub: 'status', from: 'PENDING', to: 'PAID', index: 2, hint: due.toISOString() },
      { field: 'payments', sub: 'paymentMethod', from: null, to: 'PIX', index: 2, hint: due.toISOString() },
      { field: 'payments', index: 3, hint: '2026-05-28T06:00:00.000Z', op: 'added', from: null, to: { dueDate: '2026-05-28T06:00:00.000Z', amount: 700, status: 'PENDING' } },
      { field: 'payments', index: 3, hint: '2026-05-21T06:00:00.000Z', op: 'removed', from: { dueDate: '2026-05-21T06:00:00.000Z', amount: 689, status: 'PENDING' }, to: null },
    ]);
  });

  it('desce em objetos e guarda listas simples como lista', () => {
    expect(diffDocs({ address: { city: 'Curitiba', zip: '1' } }, { address: { city: 'Londrina', zip: '1' } })).toEqual([
      { field: 'address', sub: 'city', from: 'Curitiba', to: 'Londrina' },
    ]);
    expect(diffDocs({ platforms: ['UBER'] }, { platforms: ['UBER', '99'] })).toEqual([
      { field: 'platforms', from: ['UBER'], to: ['UBER', '99'] },
    ]);
  });
});
