import { UserRole } from './schemas/user.schema';

const RANK: Record<string, number> = {
  [UserRole.READ]: 1,
  [UserRole.WRITE]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.SUPERADMIN]: 4,
};

/** Cargos que um administrador da locadora pode atribuir. */
export const TENANT_ROLES = [UserRole.ADMIN, UserRole.WRITE, UserRole.READ] as const;

/** Cargos antigos ainda no banco antes da migração viram ADMIN (decisão do produto). */
export function normalizeRole(role: string | undefined | null): UserRole | undefined {
  if (!role) return undefined;
  if (role === 'MANAGER' || role === 'VIEWER') return UserRole.ADMIN;
  return RANK[role] ? (role as UserRole) : undefined;
}

export function hasRole(role: string | undefined | null, required: UserRole): boolean {
  const r = normalizeRole(role);
  return !!r && RANK[r] >= RANK[required];
}
