import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../schemas/user.schema';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when no @Roles() metadata is present', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({ role: UserRole.VIEWER }))).toBe(true);
  });

  it('allows the request through when @Roles() is an empty array', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(buildContext({ role: UserRole.VIEWER }))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.SUPERADMIN]);
    expect(guard.canActivate(buildContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.SUPERADMIN]);
    expect(() => guard.canActivate(buildContext({ role: UserRole.MANAGER }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user at all', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
