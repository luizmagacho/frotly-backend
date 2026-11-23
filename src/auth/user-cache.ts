/** Estado do usuário (ativo/cargo) lido pelo JwtStrategy, com cache curto entre consultas ao banco. */
export type CachedUser = { at: number; isActive: boolean; role: string; tenantId: string; email: string };

/** Por quanto tempo o estado do usuário fica em cache entre consultas ao banco. */
export const USER_CACHE_MS = 30_000;

export const userCache = new Map<string, CachedUser>();

/** Chamado quando um admin muda cargo/status, para valer já na próxima requisição. */
export function invalidateUserCache(userId: string) {
  userCache.delete(String(userId));
}

export function clearUserCache() {
  userCache.clear();
}
