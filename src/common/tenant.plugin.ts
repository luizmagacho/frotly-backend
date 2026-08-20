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

  schema.pre('find', injectTenantId);
  schema.pre('findOne', injectTenantId);
  schema.pre('findOneAndUpdate', injectTenantId);
  schema.pre('countDocuments', injectTenantId);
  schema.pre('updateMany', injectTenantId);
  schema.pre('updateOne', injectTenantId);
  schema.pre('deleteMany', injectTenantId);
  schema.pre('deleteOne', injectTenantId);
  schema.pre('aggregate', function (this: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      this.pipeline().unshift({ $match: { tenantId: getTenantObjectId(tenantId) } });
    }
  });
}
