import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { UserRole } from '../auth/schemas/user.schema';

describe('UsersService', () => {
  const tenantId = String(new Types.ObjectId());
  const meId = String(new Types.ObjectId());
  const actor = { userId: meId, tenantId };
  let userModel: any;
  let service: UsersService;
  let emailService: any;
  let activeCount: number;
  let otherAdmins: number;

  const doc = (extra: any = {}) => {
    const d: any = { _id: new Types.ObjectId(), name: 'Ana', email: 'ana@x.com', role: UserRole.WRITE, isActive: true, ...extra };
    d.save = jest.fn().mockResolvedValue(d);
    d.toObject = () => ({ ...d });
    return d;
  };

  beforeEach(() => {
    activeCount = 2;
    otherAdmins = 1;
    userModel = {
      findOne: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn((f: any) => Promise.resolve(f.role === UserRole.ADMIN ? otherAdmins : activeCount)),
      create: jest.fn(async (d: any) => doc(d)),
      findById: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve({ name: 'Admin' }) }) })),
    };
    const tenantModel: any = { findById: () => ({ select: () => ({ lean: () => Promise.resolve({ name: 'Start2' }) }) }) };
    const authService: any = { issuePasswordToken: jest.fn().mockResolvedValue('tok') };
    emailService = { sendWelcomeInvite: jest.fn().mockResolvedValue(true) };
    const config: any = { get: (k: string, d?: any) => (k === 'FRONTEND_URL' ? 'https://frotly.com.br' : d) };
    service = new UsersService(userModel, tenantModel, authService, emailService, config);
  });

  it('convida: cria pendente e manda o e-mail de boas-vindas com o link de criar senha', async () => {
    const res = await service.invite(actor, { name: 'Financeiro', email: 'Financeiro@Start2.com.br', role: UserRole.ADMIN });
    expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'financeiro@start2.com.br', pendingInvite: true, role: UserRole.ADMIN }));
    expect(emailService.sendWelcomeInvite).toHaveBeenCalledWith(
      expect.objectContaining({ link: 'https://frotly.com.br/definir-senha?token=tok', tenantName: 'Start2', inviterName: 'Admin', roleLabel: 'Administrador' }),
    );
    expect(res.emailSent).toBe(true);
    expect(res.inviteLink).toBeUndefined();
  });

  it('se o e-mail falhar, devolve o link para o admin enviar por outro canal', async () => {
    emailService.sendWelcomeInvite.mockResolvedValue(false);
    const res = await service.invite(actor, { name: 'X', email: 'x@x.com', role: UserRole.READ });
    expect(res.inviteLink).toContain('/definir-senha?token=tok');
  });

  it('recusa o 6º usuário ativo', async () => {
    activeCount = 5;
    await expect(service.invite(actor, { name: 'X', email: 'x@x.com', role: UserRole.READ })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa e-mail repetido na mesma locadora', async () => {
    userModel.findOne.mockResolvedValue(doc());
    await expect(service.invite(actor, { name: 'X', email: 'ana@x.com', role: UserRole.READ })).rejects.toBeInstanceOf(ConflictException);
  });

  it('não deixa mudar o próprio cargo nem se desativar', async () => {
    userModel.findOne.mockResolvedValue(doc({ _id: new Types.ObjectId(meId), role: UserRole.ADMIN }));
    await expect(service.updateRole(actor, meId, UserRole.READ)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deactivate(actor, meId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não deixa a locadora sem administrador ativo', async () => {
    const other = doc({ role: UserRole.ADMIN });
    userModel.findOne.mockResolvedValue(other);
    otherAdmins = 0;
    await expect(service.updateRole(actor, String(other._id), UserRole.WRITE)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deactivate(actor, String(other._id))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desativa e reativa respeitando o limite', async () => {
    const u = doc();
    userModel.findOne.mockResolvedValue(u);
    await service.deactivate(actor, String(u._id));
    expect(u.isActive).toBe(false);
    activeCount = 5;
    await expect(service.reactivate(actor, String(u._id))).rejects.toBeInstanceOf(ForbiddenException);
    activeCount = 4;
    await service.reactivate(actor, String(u._id));
    expect(u.isActive).toBe(true);
  });
});
