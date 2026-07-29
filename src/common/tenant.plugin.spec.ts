import { Schema } from 'mongoose';
import { tenantPlugin } from './tenant.plugin';
import { tenantContext } from './tenant.context';

describe('tenantPlugin', () => {
  it('registers no hooks at all on a schema without a tenantId path (the fixed bug)', () => {
    const schema = new Schema({ name: String });
    const preSpy = jest.spyOn(schema, 'pre');

    tenantPlugin(schema);

    expect(preSpy).not.toHaveBeenCalled();
  });

  it('registers tenant-scoping hooks on a schema that has a tenantId path', () => {
    const schema = new Schema({ tenantId: Schema.Types.ObjectId, name: String });
    const preSpy = jest.spyOn(schema, 'pre');

    tenantPlugin(schema);

    const registeredHooks = preSpy.mock.calls.map((call) => call[0]);
    expect(registeredHooks).toEqual(
      expect.arrayContaining([
        'validate',
        'insertMany',
        'find',
        'findOne',
        'findOneAndUpdate',
        'countDocuments',
        'updateMany',
        'updateOne',
        'deleteMany',
        'deleteOne',
        'aggregate',
      ]),
    );
  });

  describe('behavior of the registered hooks (tenant-scoped schema)', () => {
    const getHook = (schema: Schema, name: string) => {
      const preSpy = schema.pre as jest.Mock;
      const call = preSpy.mock.calls.find((c) => c[0] === name);
      return call?.[1];
    };

    let schema: Schema;

    beforeEach(() => {
      schema = new Schema({ tenantId: Schema.Types.ObjectId, name: String });
      jest.spyOn(schema, 'pre');
      tenantPlugin(schema);
    });

    it('find/findOne/etc add a { tenantId } filter when a tenant context is active', () => {
      const findHook = getHook(schema, 'find');
      const whereMock = jest.fn();

      tenantContext.run({ tenantId: 'tenant-abc' }, () => {
        findHook!.call({ where: whereMock });
      });

      expect(whereMock).toHaveBeenCalledWith({ tenantId: 'tenant-abc' });
    });

    it('does not add a filter when no tenant context is active (e.g. during login)', () => {
      const findHook = getHook(schema, 'find');
      const whereMock = jest.fn();

      findHook!.call({ where: whereMock });

      expect(whereMock).not.toHaveBeenCalled();
    });

    it('validate hook stamps tenantId from context onto a new document that lacks one', () => {
      const validateHook = getHook(schema, 'validate');
      const doc: any = {};

      tenantContext.run({ tenantId: 'tenant-abc' }, () => {
        validateHook!.call(doc);
      });

      expect(doc.tenantId).toBe('tenant-abc');
    });

    it('validate hook does not override a tenantId the document already has', () => {
      const validateHook = getHook(schema, 'validate');
      const doc: any = { tenantId: 'already-set' };

      tenantContext.run({ tenantId: 'tenant-abc' }, () => {
        validateHook!.call(doc);
      });

      expect(doc.tenantId).toBe('already-set');
    });

    it('aggregate hook prepends a $match stage scoped to the active tenant', () => {
      const aggregateHook = getHook(schema, 'aggregate');
      const pipeline: any[] = [{ $group: { _id: '$foo' } }];
      const pipelineMock = jest.fn().mockReturnValue(pipeline);

      tenantContext.run({ tenantId: 'tenant-abc' }, () => {
        aggregateHook!.call({ pipeline: pipelineMock });
      });

      expect(pipeline[0]).toEqual({ $match: { tenantId: 'tenant-abc' } });
    });
  });
});
