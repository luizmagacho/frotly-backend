import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../schemas/user.schema';

export const MIN_ROLE_KEY = 'minRole';

/**
 * Cargo mínimo para a rota. Sem o decorator, o JwtAuthGuard exige READ para
 * GET/HEAD e WRITE para qualquer alteração (POST/PUT/PATCH/DELETE).
 * Ex.: @MinRole(UserRole.ADMIN) em usuários e auditoria; @MinRole(UserRole.READ)
 * em "marcar notificação como lida".
 */
export const MinRole = (role: UserRole) => SetMetadata(MIN_ROLE_KEY, role);
