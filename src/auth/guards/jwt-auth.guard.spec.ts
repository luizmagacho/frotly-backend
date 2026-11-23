import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from '../schemas/user.schema';

describe('JwtAuthGuard — permissões por cargo', () => {
  let minRole: UserRole | undefined;
  const reflector = { getAllAndOverride: jest.fn(() => minRole) } as unknown as Reflector;
  const guard = new JwtAuthGuard(reflector);

  beforeAll(() => {
    // Autenticação (passport) fora do escopo deste teste: considera o token válido.
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true as never);
  });

  const ctx = (method: string, role: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method, user: { role } }) }),
      getHandler: () => null,
      getClass: () => null,
    }) as any;

  const allowed = (method: string, role: string) => guard.canActivate(ctx(method, role)).then(() => true, (e) => {
    if (e instanceof ForbiddenException) return false;
    throw e;
  });

  beforeEach(() => (minRole = undefined));

  it('READ só consulta', async () => {
    expect(await allowed('GET', 'READ')).toBe(true);
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(await allowed(m, 'READ')).toBe(false);
  });

  it('WRITE consulta e altera', async () => {
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) expect(await allowed(m, 'WRITE')).toBe(true);
  });

  it('rotas de administrador recusam WRITE e READ, até em GET', async () => {
    minRole = UserRole.ADMIN;
    expect(await allowed('GET', 'WRITE')).toBe(false);
    expect(await allowed('GET', 'READ')).toBe(false);
    expect(await allowed('POST', 'ADMIN')).toBe(true);
    expect(await allowed('GET', 'SUPERADMIN')).toBe(true);
  });

  it('@MinRole(READ) libera alteração simples para leitura (ex.: marcar notificação lida)', async () => {
    minRole = UserRole.READ;
    expect(await allowed('PATCH', 'READ')).toBe(true);
  });

  it('cargo desconhecido não passa', async () => {
    expect(await allowed('GET', 'HACKER')).toBe(false);
  });
});
