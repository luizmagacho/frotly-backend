import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './schemas/tenant.schema';
import { AuthService } from '../auth/auth.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantModel: jest.Mock & Record<string, jest.Mock>;
  let authService: { createUser: jest.Mock; login: jest.Mock };
  let lastSavedDoc: any;

  const buildTenantModelMock = () => {
    const ctor: any = jest.fn().mockImplementation((doc: any) => {
      const instance = {
        ...doc,
        _id: doc._id ?? 'new-tenant-id',
        save: jest.fn().mockImplementation(function (this: any) {
          lastSavedDoc = this;
          return Promise.resolve(this);
        }),
      };
      return instance;
    });
    ctor.findOne = jest.fn();
    ctor.exists = jest.fn();
    ctor.find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    ctor.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    ctor.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    ctor.findByIdAndDelete = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    ctor.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    return ctor;
  };

  beforeEach(async () => {
    tenantModel = buildTenantModelMock();
    authService = { createUser: jest.fn(), login: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getModelToken(Tenant.name), useValue: tenantModel },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('subdomain slug generation', () => {
    it('slugifies the tenant name, stripping accents and punctuation', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.exists.mockResolvedValue(false);

      await service.create({ name: 'Locação São José & Cia.', cnpj: '11111111000111' } as any);

      expect(lastSavedDoc.subdomain).toBe('locacao-sao-jose-cia');
    });

    it('appends a numeric suffix when the slug is already taken', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.exists
        .mockResolvedValueOnce(true) // "locadora-x" taken
        .mockResolvedValueOnce(true) // "locadora-x-2" taken
        .mockResolvedValueOnce(false); // "locadora-x-3" free

      await service.create({ name: 'Locadora X', cnpj: '22222222000122' } as any);

      expect(lastSavedDoc.subdomain).toBe('locadora-x-3');
    });

    it('falls back to "locadora" when the name slugifies to nothing usable', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.exists.mockResolvedValue(false);

      await service.create({ name: '!!!', cnpj: '33333333000133' } as any);

      expect(lastSavedDoc.subdomain).toBe('locadora');
    });
  });

  describe('create', () => {
    it('rejects a duplicate CNPJ', async () => {
      tenantModel.findOne.mockResolvedValue({ _id: 'existing' });
      await expect(service.create({ name: 'X', cnpj: '00000000000000' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('signup', () => {
    const dto = {
      tenantName: 'Locadora Nova',
      cnpj: '44444444000144',
      adminName: 'Admin Novo',
      adminEmail: 'admin@novo.com',
      adminPassword: 'SenhaForte123',
    };

    it('creates the tenant and the admin user, then logs in', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.exists.mockResolvedValue(false);
      authService.createUser.mockResolvedValue({ _id: 'user-1' });
      authService.login.mockResolvedValue({ accessToken: 'jwt', user: { id: 'user-1' } });

      const result = await service.signup(dto as any);

      expect(authService.createUser).toHaveBeenCalledWith(
        dto.adminEmail,
        dto.adminPassword,
        dto.adminName,
        'new-tenant-id',
        'ADMIN',
      );
      expect(result).toEqual({ accessToken: 'jwt', user: { id: 'user-1' } });
    });

    it('rejects a duplicate CNPJ before creating anything', async () => {
      tenantModel.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(service.signup(dto as any)).rejects.toThrow(ConflictException);
      expect(authService.createUser).not.toHaveBeenCalled();
    });

    it('rolls back the tenant if creating the admin user fails', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.exists.mockResolvedValue(false);
      authService.createUser.mockRejectedValue(new Error('duplicate key'));

      await expect(service.signup(dto as any)).rejects.toThrow('duplicate key');
      expect(tenantModel.deleteOne).toHaveBeenCalledWith({ _id: 'new-tenant-id' });
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('findPublicBySubdomain', () => {
    it('returns only the branding-safe fields for an active tenant', async () => {
      const selectMock = jest.fn().mockReturnThis();
      const execMock = jest.fn().mockResolvedValue({ name: 'Locadora X', subdomain: 'locadora-x' });
      tenantModel.findOne.mockReturnValue({ select: selectMock, exec: execMock });

      const result = await service.findPublicBySubdomain('LOCADORA-X');

      expect(tenantModel.findOne).toHaveBeenCalledWith({ subdomain: 'locadora-x', isActive: true });
      expect(selectMock).toHaveBeenCalledWith('name subdomain logoUrl primaryColor customDomain');
      expect(result).toEqual({ name: 'Locadora X', subdomain: 'locadora-x' });
    });

    it('throws NotFoundException for an inactive or unknown subdomain', async () => {
      tenantModel.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) });
      await expect(service.findPublicBySubdomain('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne / update / remove', () => {
    it('throws NotFoundException when findOne finds nothing', async () => {
      tenantModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when updating a tenant that does not exist', async () => {
      tenantModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.update('missing', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when removing a tenant that does not exist', async () => {
      tenantModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
