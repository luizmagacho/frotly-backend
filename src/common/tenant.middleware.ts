import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          if (decoded && decoded.tenantId) {
            tenantId = decoded.tenantId;
          }
        }
      } catch (e) {
        // Ignore invalid tokens here; the AuthGuard will reject them later
      }
    }

    if (tenantId) {
      tenantContext.run({ tenantId }, () => {
        next();
      });
    } else {
      next();
    }
  }
}
