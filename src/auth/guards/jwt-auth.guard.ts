import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';
import { UserRole } from '../schemas/user.schema';
import { hasRole } from '../roles';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Autentica (token válido, usuário ativo) e aplica o cargo mínimo da rota.
 * Toda rota protegida passa por aqui, então a regra vale para a API inteira:
 * leitura exige READ, alteração exige WRITE, e rotas marcadas com @MinRole
 * exigem o cargo indicado (ex.: ADMIN para usuários e auditoria).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    const req = context.switchToHttp().getRequest();
    const required =
      this.reflector.getAllAndOverride<UserRole>(MIN_ROLE_KEY, [context.getHandler(), context.getClass()]) ??
      (SAFE_METHODS.has(req.method) ? UserRole.READ : UserRole.WRITE);

    if (!hasRole(req.user?.role, required)) {
      throw new ForbiddenException(
        required === UserRole.READ || required === UserRole.WRITE
          ? 'Seu acesso é somente leitura. Peça a um administrador para alterar seu cargo.'
          : 'Apenas administradores podem fazer isso.',
      );
    }
    return true;
  }
}
