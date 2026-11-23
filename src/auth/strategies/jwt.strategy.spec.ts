import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtStrategy } from './jwt.strategy';
import { clearUserCache } from '../user-cache';

describe('JwtStrategy.validate', () => {
  const userId = new Types.ObjectId();
  const tenantId = new Types.ObjectId();
  let doc: any;
  let findById: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    clearUserCache();
    doc = { _id: userId, isActive: true, role: 'ADMIN', tenantId, email: 'a@x.com' };
    findById = jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(doc) }) }));
    const config: any = { get: () => 'x'.repeat(40) };
    strategy = new JwtStrategy(config, { findById } as any);
  });

  const payload = (extra: any = {}) => ({ sub: String(userId), email: 'a@x.com', role: 'VIEWER', tenantId: String(tenantId), ...extra });

  it('usa o cargo atual do banco, não o do token', async () => {
    const user = await strategy.validate(payload());
    expect(user).toEqual({ userId: String(userId), email: 'a@x.com', role: 'ADMIN', tenantId: String(tenantId) });
  });

  it('recusa usuário desativado depois do login', async () => {
    doc.isActive = false;
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa usuário que não existe mais', async () => {
    doc = null;
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token cujo tenant não bate com o do usuário', async () => {
    await expect(strategy.validate(payload({ tenantId: String(new Types.ObjectId()) }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('converte cargos antigos (MANAGER/VIEWER) para ADMIN', async () => {
    doc.role = 'VIEWER';
    const user = await strategy.validate(payload());
    expect(user.role).toBe('ADMIN');
  });

  it('guarda em cache por pouco tempo (não consulta o banco a cada requisição)', async () => {
    await strategy.validate(payload());
    await strategy.validate(payload());
    expect(findById).toHaveBeenCalledTimes(1);
  });
});
