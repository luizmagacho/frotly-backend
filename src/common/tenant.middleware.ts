import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { RequestActor, tenantContext } from './tenant.context';

/**
 * Define o cliente (tenant) da requisição a partir do login. O token só é aceito se a
 * assinatura for válida: antes o payload era lido sem verificação, então um token forjado
 * escolhia o tenant usado pelo filtro do banco em rotas sem JwtAuthGuard.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let actor: RequestActor | undefined;

    const authHeader = req.headers.authorization;
    const secret = process.env.JWT_SECRET;
    if (secret && authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = verify(authHeader.substring(7), secret) as { tenantId?: unknown; sub?: unknown; email?: unknown };
        if (decoded && decoded.tenantId) {
          tenantId = String(decoded.tenantId);
          if (decoded.sub) {
            const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
            actor = { userId: String(decoded.sub), email: decoded.email ? String(decoded.email) : undefined, ip: fwd || req.ip };
          }
        }
      } catch {
        // Token inválido/expirado: sem contexto de tenant; o JwtAuthGuard recusa a rota protegida.
      }
    }

    if (tenantId) {
      tenantContext.run({ tenantId, actor }, () => next());
    } else {
      next();
    }
  }
}
