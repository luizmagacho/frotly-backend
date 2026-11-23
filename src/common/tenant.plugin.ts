import { Schema, Types } from 'mongoose';
import { getTenantId } from './tenant.context';

export function tenantPlugin(schema: Schema) {
  // Schemas without a tenantId field (e.g. Tenant itself) aren't tenant-scoped —
  // applying these hooks anyway would silently add a `{ tenantId }` filter on a
  // field that doesn't exist, returning zero rows for any authenticated request.
  if (!schema.path('tenantId')) {
    return;
  }

  const getTenantObjectId = (tenantId: string) => {
    try {
      return new Types.ObjectId(tenantId);
    } catch {
      return tenantId;
    }
  };

  const injectTenantId = function (this: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      this.where({ tenantId: getTenantObjectId(tenantId) });
    }
  };

  schema.pre('validate', function (this: any) {
    const tenantId = getTenantId();
    if (tenantId && !this.tenantId) {
      this.tenantId = getTenantObjectId(tenantId);
    }
  });

  schema.pre('insertMany', function (next: any, docs: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      const tenantObjId = getTenantObjectId(tenantId);
      if (Array.isArray(docs)) {
        docs.forEach((doc: any) => {
          if (!doc.tenantId) {
            doc.tenantId = tenantObjId;
          }
        });
      }
    }
    if (typeof next === 'function') next();
  });

  // Toda operação de consulta/alteração que recebe filtro. findByIdAndDelete/Remove viram
  // findOneAndDelete; findByIdAndUpdate vira findOneAndUpdate. Faltar uma delas aqui deixa
  // um cliente alterar ou excluir dados de outro sabendo apenas o _id.
  const QUERY_OPS = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'countDocuments',
    'distinct',
    'updateMany',
    'updateOne',
    'replaceOne',
    'deleteMany',
    'deleteOne',
  ] as const;
  for (const op of QUERY_OPS) schema.pre(op as any, injectTenantId);
  schema.pre('aggregate', function (this: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      this.pipeline().unshift({ $match: { tenantId: getTenantObjectId(tenantId) } });
    }
  });
}
