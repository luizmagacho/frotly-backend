import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from './schemas/user.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: { find: jest.Mock; findOne: jest.Mock };
  let tenantModel: { find: jest.Mock };
  let jwtService: { sign: jest.Mock };

  const buildUser = (overrides: Partial<any> = {}) => ({
    _id: 'user-1',
    email: 'shared@multitenant.com',
    password: 'hashed',
    name: 'Some User',
    role: UserRole.ADMIN,
    isActive: true,
    tenantId: { toString: () => 'tenant-1' },
    ...overrides,
  });

  beforeEach(async () => {
    userModel = { find: jest.fn(), findOne: jest.fn() };
    tenantModel = { find: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Tenant.name), useValue: tenantModel },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    (bcrypt.compare as jest.Mock).mockReset();
  });

  describe('login — single tenant (common case)', () => {
    it('logs in when exactly one user matches the email and the password is correct', async () => {
      const user = buildUser();
      userModel.find.mockResolvedValue([user]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result: any = await service.login('shared@multitenant.com', 'correct-password');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('shared@multitenant.com');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', tenantId: user.tenantId }),
      );
    });

    it('rejects with a generic message when the password is wrong', async () => {
      userModel.find.mockResolvedValue([buildUser()]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('shared@multitenant.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with a generic message when no user has that email at all', async () => {
      userModel.find.mockResolvedValue([]);

      await expect(service.login('nobody@nowhere.com', 'whatever')).rejects.toThrow(UnauthorizedException);
    });

    it('ignores inactive users implicitly by only ever receiving active ones from the query', async () => {
      // isActive filtering happens in the Mongo query itself; this just confirms
      // the query is built with that filter so an inactive user is never a candidate.
      userModel.find.mockResolvedValue([]);
      await expect(service.login('inactive@user.com', 'whatever')).rejects.toThrow(UnauthorizedException);
      expect(userModel.find).toHaveBeenCalledWith({ email: 'inactive@user.com', isActive: true });
    });
  });

  describe('login — same email across multiple tenants', () => {
    it('returns requiresTenantSelection when password matches more than one tenant and none was specified', async () => {
      const userA = buildUser({ _id: 'user-a', tenantId: { toString: () => 'tenant-a' } });
      const userB = buildUser({ _id: 'user-b', tenantId: { toString: () => 'tenant-b' } });
      userModel.find.mockResolvedValue([userA, userB]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tenantModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'tenant-a', name: 'Locadora A', subdomain: 'locadora-a' },
          { _id: 'tenant-b', name: 'Locadora B', subdomain: 'locadora-b' },
        ]),
      });

      const result: any = await service.login('shared@multitenant.com', 'correct-password');

      expect(result.requiresTenantSelection).toBe(true);
      expect(result.tenants).toEqual([
        { id: 'tenant-a', name: 'Locadora A', subdomain: 'locadora-a' },
        { id: 'tenant-b', name: 'Locadora B', subdomain: 'locadora-b' },
      ]);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('never reveals multi-tenant membership when the password is wrong for every candidate', async () => {
      const userA = buildUser({ _id: 'user-a', tenantId: { toString: () => 'tenant-a' } });
      const userB = buildUser({ _id: 'user-b', tenantId: { toString: () => 'tenant-b' } });
      userModel.find.mockResolvedValue([userA, userB]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('shared@multitenant.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tenantModel.find).not.toHaveBeenCalled();
    });

    it('logs into the chosen tenant when a valid tenantId is supplied', async () => {
      const userA = buildUser({ _id: 'user-a', tenantId: { toString: () => 'tenant-a' } });
      const userB = buildUser({ _id: 'user-b', tenantId: { toString: () => 'tenant-b' } });
      userModel.find.mockResolvedValue([userA, userB]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result: any = await service.login('shared@multitenant.com', 'correct-password', 'tenant-b');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 'user-b' }));
    });

    it('rejects a tenantId that is not among the password-matched candidates', async () => {
      const userA = buildUser({ _id: 'user-a', tenantId: { toString: () => 'tenant-a' } });
      const userB = buildUser({ _id: 'user-b', tenantId: { toString: () => 'tenant-b' } });
      userModel.find.mockResolvedValue([userA, userB]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login('shared@multitenant.com', 'correct-password', 'tenant-does-not-exist'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createUser', () => {
    it('hashes the password and persists the user with the given tenantId/role', async () => {
      const saveMock = jest.fn().mockResolvedValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: getModelToken(User.name),
            useValue: Object.assign(
              jest.fn().mockImplementation((doc) => ({ ...doc, save: saveMock })),
              userModel,
            ),
          },
          { provide: getModelToken(Tenant.name), useValue: tenantModel },
          { provide: JwtService, useValue: jwtService },
        ],
      }).compile();
      const svc = module.get<AuthService>(AuthService);

      await svc.createUser('new@user.com', 'plaintext', 'New User', 'tenant-1', UserRole.MANAGER);

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 12);
      expect(saveMock).toHaveBeenCalled();
    });
  });
});
