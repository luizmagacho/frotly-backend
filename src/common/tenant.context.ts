import { AsyncLocalStorage } from 'async_hooks';

/** Quem está fazendo a requisição — usado pela auditoria. */
export type RequestActor = { userId: string; email?: string; ip?: string };

export const tenantContext = new AsyncLocalStorage<{ tenantId: string; actor?: RequestActor }>();

export function getTenantId(): string | undefined {
  const store = tenantContext.getStore();
  return store?.tenantId;
}

export function getActor(): RequestActor | undefined {
  return tenantContext.getStore()?.actor;
}
