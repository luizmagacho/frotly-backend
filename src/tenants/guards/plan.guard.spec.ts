import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanGuard } from './plan.guard';
import { PlanType } from '../schemas/tenant.schema';

describe('PlanGuard', () => {
  let guard: PlanGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let tenantModel: { findById: jest.Mock };

  const buildContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  const mockTenantQuery = (plan: PlanType | null) => ({
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(plan ? { plan } : null),
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    tenantModel = { findById: jest.fn() };
    guard = new PlanGuard(reflector as unknown as Reflector, tenantModel as any);
  });

  it('allows the request through when no @RequiresPlan() metadata is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tenantModel.findById).not.toHaveBeenCalled();
  });

  it('rejects when there is no authenticated user with a tenantId', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.PRO);
    const context = buildContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a BASIC tenant from a PRO-gated route', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.PRO);
    tenantModel.findById.mockReturnValue(mockTenantQuery(PlanType.BASIC));
    const context = buildContext({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows a PRO tenant into a PRO-gated route', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.PRO);
    tenantModel.findById.mockReturnValue(mockTenantQuery(PlanType.PRO));
    const context = buildContext({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows an ENTERPRISE tenant into a PRO-gated route (higher rank satisfies a lower requirement)', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.PRO);
    tenantModel.findById.mockReturnValue(mockTenantQuery(PlanType.ENTERPRISE));
    const context = buildContext({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a PRO tenant from an ENTERPRISE-gated route', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.ENTERPRISE);
    tenantModel.findById.mockReturnValue(mockTenantQuery(PlanType.PRO));
    const context = buildContext({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the tenant referenced by the token no longer exists', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanType.BASIC);
    tenantModel.findById.mockReturnValue(mockTenantQuery(null));
    const context = buildContext({ tenantId: 'ghost-tenant' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
