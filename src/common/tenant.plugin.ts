import { Schema, Types } from 'mongoose';
import { getTenantId } from './tenant.context';

export function tenantPlugin(schema: Schema) {
  // Schemas without a tenantId field (e.g. Tenant itself) aren't tenant-scoped —
  // applying these hooks anyway would silently add a `{ tenantId }` filter on a
  // field that doesn't exist, returning zero rows for any authenticated request.
  if (!schema.path('tenantId')) {
    return;
  }

  const injectTenantId = function (this: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      try {
        const objectId = new Types.ObjectId(tenantId);
        this.where({ tenantId: objectId });
      } catch (e) {
        this.where({ tenantId });
      }
    }
  };

  schema.pre('validate', function (this: any) {
    const tenantId = getTenantId();
    if (tenantId && !this.tenantId) {
      this.tenantId = tenantId;
    }
  });

  schema.pre('insertMany', function (next: any, docs: any) {
    const tenantId = getTenantId();
    if (tenantId) {
      if (Array.isArray(docs)) {
        docs.forEach((doc: any) => {
          if (!doc.tenantId) {
            doc.tenantId = tenantId;
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
      this.pipeline().unshift({ $match: { tenantId } });
    }
  });
}
