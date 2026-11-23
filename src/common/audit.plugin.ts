import { Logger } from '@nestjs/common';
import { Schema, Types } from 'mongoose';
import { getActor, getTenantId } from './tenant.context';

/**
 * Auditoria central: registra em `audit_logs` quem criou, editou ou excluiu cada
 * registro de uma locadora. Funciona como plugin global do Mongoose, então cobre
 * todo serviço sem precisar chamar nada nos controllers.
 *
 * Só registra ações feitas por um usuário logado (há um "actor" no contexto da
 * requisição). Rotinas automáticas (crons, webhooks) não geram registro.
 * A gravação é feita direto no driver, sem passar pelos hooks, e nunca derruba
 * a operação principal se falhar.
 */

export const AUDIT_COLLECTION = 'audit_logs';

/** Coleções que não fazem sentido auditar (logs de si mesmas ou ruído). */
const SKIP_COLLECTIONS = new Set([AUDIT_COLLECTION, 'notifications', 'history_events', 'detran_queries']);

/** Campos que não entram no diff: técnicos ou sensíveis. */
const IGNORED_FIELDS = new Set([
  '_id', '__v', 'id', 'createdAt', 'updatedAt', 'tenantId',
  'password', 'resetPasswordToken', 'resetPasswordExpires', 'lastLoginAt',
]);

/** Campos usados como nome legível do registro, em ordem de preferência. */
const LABEL_FIELDS = ['licensePlate', 'name', 'title', 'noticeNumber', 'description', 'email', 'policyNumber', 'insurer', 'stationName'];

const MAX_FIELDS = 40;
const MAX_VALUE_CHARS = 300;
const MAX_BULK = 200;

const logger = new Logger('Audit');

/**
 * Uma mudança. Campos simples: { field, from, to }. Dentro de objetos: `sub` traz o caminho
 * (ex.: field 'address', sub 'city'). Dentro de listas (ex.: pagamentos de um aluguel):
 * `index` é a posição do item (começa em 1), `hint` ajuda a reconhecê-lo (vencimento, nome)
 * e `op` diz se o item foi adicionado ou removido (aí from/to trazem o item resumido).
 */
export type AuditChange = { field: string; from: unknown; to: unknown; sub?: string; index?: number; hint?: string; op?: 'added' | 'removed' };
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

const isObjectId = (v: any) => v instanceof Types.ObjectId || v?._bsontype === 'ObjectId';
const isPlainObject = (v: any): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isObjectId(v) && !Buffer.isBuffer(v);

/** Valor legível e pequeno o bastante para guardar no log. */
export function summarize(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (isObjectId(v)) return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v.length > MAX_VALUE_CHARS ? v.slice(0, MAX_VALUE_CHARS) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  // Lista de valores simples (ex.: plataformas): guarda como lista para a tela juntar.
  if (Array.isArray(v) && v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x) || isObjectId(x) || x instanceof Date)) {
    return v.slice(0, 30).map((x) => summarize(x));
  }
  let json: string;
  try {
    json = JSON.stringify(v, (_k, val) => (isObjectId(val) ? String(val) : val));
  } catch {
    json = String(v);
  }
  return json.length > MAX_VALUE_CHARS ? json.slice(0, MAX_VALUE_CHARS) + '…' : json;
}

function comparable(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (isObjectId(v)) return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v, (_k, val) => (isObjectId(val) ? String(val) : val));
  } catch {
    return String(v);
  }
}

/** Achata objetos aninhados em caminhos 'a.b.c' (listas ficam como valor). */
function flatten(obj: Record<string, any>, prefix = '', out: Record<string, any> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (IGNORED_FIELDS.has(k) || k.startsWith('$')) continue;
    if (isPlainObject(v) && Object.keys(v).length) flatten(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = v;
  }
  return out;
}

/** Item de lista resumido em pares campo → valor (para itens adicionados/removidos). */
function summarizeItem(item: any): unknown {
  if (!isPlainObject(item)) return summarize(item);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flatten(item))) {
    if (v === null || v === undefined || v === '') continue;
    out[k] = summarize(v);
  }
  return out;
}

const HINT_FIELDS = ['dueDate', 'date', 'startDate', 'name', 'title', 'description', 'licensePlate'];
function hintOf(item: any): string | undefined {
  if (!isPlainObject(item)) return undefined;
  for (const f of HINT_FIELDS) {
    const v = summarize(item[f]);
    if (typeof v === 'string' && v) return v.slice(0, 80);
  }
  return undefined;
}

function diffObjects(field: string, b: Record<string, any>, a: Record<string, any>, extra: Partial<AuditChange>, changes: AuditChange[]) {
  const fb = flatten(b);
  const fa = flatten(a);
  for (const k of new Set([...Object.keys(fb), ...Object.keys(fa)])) {
    if (changes.length >= MAX_FIELDS) return;
    if (comparable(fb[k]) === comparable(fa[k])) continue;
    changes.push({ field, sub: k, from: summarize(fb[k]), to: summarize(fa[k]), ...extra });
  }
}

/** Compara listas item a item (por _id quando houver, senão pela posição). */
function diffArrays(field: string, b: any[], a: any[], changes: AuditChange[]) {
  const all = [...b, ...a];
  if (!all.length) return;
  if (!all.every((x) => isPlainObject(x))) {
    changes.push({ field, from: summarize(b), to: summarize(a) });
    return;
  }
  const keyed = all.every((x) => x._id);
  const before = new Map<string, { item: any; pos: number }>();
  b.forEach((item, i) => before.set(keyed ? String(item._id) : String(i), { item, pos: i }));
  const seen = new Set<string>();
  a.forEach((item, i) => {
    if (changes.length >= MAX_FIELDS) return;
    const key = keyed ? String(item._id) : String(i);
    seen.add(key);
    const prev = before.get(key);
    if (!prev) changes.push({ field, index: i + 1, hint: hintOf(item), op: 'added', from: null, to: summarizeItem(item) });
    else diffObjects(field, prev.item, item, { index: i + 1, hint: hintOf(item) }, changes);
  });
  for (const [key, { item, pos }] of before) {
    if (changes.length >= MAX_FIELDS) return;
    if (!seen.has(key)) changes.push({ field, index: pos + 1, hint: hintOf(item), op: 'removed', from: summarizeItem(item), to: null });
  }
}

/** O que mudou entre duas versões do documento, descendo em objetos e listas. */
export function diffDocs(before: Record<string, any> | null | undefined, after: Record<string, any> | null | undefined): AuditChange[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: AuditChange[] = [];
  for (const k of keys) {
    if (changes.length >= MAX_FIELDS) break;
    if (IGNORED_FIELDS.has(k) || k.startsWith('$')) continue;
    if (comparable(b[k]) === comparable(a[k])) continue;
    const bv = b[k];
    const av = a[k];
    if ((Array.isArray(bv) || bv == null) && (Array.isArray(av) || av == null) && (Array.isArray(bv) || Array.isArray(av))) {
      diffArrays(k, bv ?? [], av ?? [], changes);
    } else if (isPlainObject(bv) && isPlainObject(av)) {
      diffObjects(k, bv, av, {}, changes);
    } else {
      changes.push({ field: k, from: summarize(bv), to: summarize(av) });
    }
  }
  return changes.slice(0, MAX_FIELDS);
}

export function labelOf(doc: Record<string, any> | null | undefined): string | undefined {
  if (!doc) return undefined;
  for (const f of LABEL_FIELDS) {
    const v = doc[f];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
  }
  return undefined;
}

const plain = (doc: any) => (doc && typeof doc.toObject === 'function' ? doc.toObject({ depopulate: true }) : doc);

// Nome de quem fez a ação, com cache curto (o log guarda o nome da época).
const nameCache = new Map<string, { at: number; name?: string; email?: string }>();

async function actorInfo(db: any, userId: string) {
  const hit = nameCache.get(userId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit;
  let info: { at: number; name?: string; email?: string } = { at: Date.now() };
  try {
    const u = await db.collection('users').findOne({ _id: new Types.ObjectId(userId) }, { projection: { name: 1, email: 1 } });
    info = { at: Date.now(), name: u?.name, email: u?.email };
  } catch {
    /* id inválido ou banco indisponível: grava sem nome */
  }
  nameCache.set(userId, info);
  if (nameCache.size > 2000) nameCache.delete(nameCache.keys().next().value as string);
  return info;
}

type Entry = { action: AuditAction; entityId?: unknown; label?: string; changes?: AuditChange[]; snapshot?: unknown; count?: number; tenantId?: unknown };

async function write(model: any, entries: Entry[]) {
  const actor = getActor();
  const db = model?.db?.db;
  if (!actor || !db || entries.length === 0) return;
  const entity: string = model.collection?.collectionName;
  try {
    const who = await actorInfo(db, actor.userId);
    const ctxTenant = getTenantId();
    const docs = entries.map((e) => ({
      tenantId: new Types.ObjectId(String(e.tenantId ?? ctxTenant)),
      actorId: new Types.ObjectId(actor.userId),
      actorName: who.name ?? null,
      actorEmail: who.email ?? actor.email ?? null,
      ip: actor.ip ?? null,
      action: e.action,
      entity,
      entityId: e.entityId ? String(e.entityId) : null,
      label: e.label ?? null,
      changes: e.changes ?? [],
      snapshot: e.snapshot ?? null,
      count: e.count ?? null,
      createdAt: new Date(),
    }));
    await db.collection(AUDIT_COLLECTION).insertMany(docs, { ordered: false });
  } catch (err: any) {
    logger.error(`Falha ao gravar auditoria de ${entity}: ${err.message}`);
  }
}

/** Snapshot reduzido do registro excluído, para consulta futura. */
function snapshotOf(doc: any) {
  const out: Record<string, unknown> = {};
  const src = plain(doc) ?? {};
  if (src._id) out._id = summarize(src._id);
  for (const [k, v] of Object.entries(flatten(src))) {
    // Listas de registros (ex.: pagamentos) viram só a contagem; o detalhe fica nos logs de edição.
    if (Array.isArray(v) && v.some((x) => isPlainObject(x))) out[k] = { count: v.length };
    else out[k] = summarize(v);
  }
  return out;
}

const active = (collectionName: string | undefined) => !!getActor() && !!collectionName && !SKIP_COLLECTIONS.has(collectionName);
const UPDATE_OPS = ['findOneAndUpdate', 'updateOne', 'replaceOne', 'findOneAndReplace'] as const;
const DELETE_ONE_OPS = ['findOneAndDelete', 'deleteOne'] as const;

export function auditPlugin(schema: Schema) {
  // Só documentos de locadora (mesma regra do tenantPlugin). Subdocumentos e Tenant ficam de fora.
  if (!schema.path('tenantId')) return;

  // ── save(): criação ou edição de um documento carregado ──────────────────
  schema.pre('save', async function (this: any) {
    const Model = this.constructor as any;
    if (!active(Model?.collection?.collectionName)) return;
    this.$locals.auditIsNew = this.isNew;
    if (!this.isNew) this.$locals.auditBefore = await Model.findById(this._id).lean();
  });
  schema.post('save', function (this: any, doc: any) {
    const Model = doc.constructor as any;
    if (!active(Model?.collection?.collectionName) || doc.$locals.auditIsNew === undefined) return;
    const after = plain(doc);
    if (doc.$locals.auditIsNew) {
      void write(Model, [{ action: 'CREATE', entityId: doc._id, label: labelOf(after), tenantId: after.tenantId }]);
    } else {
      const changes = diffDocs(doc.$locals.auditBefore, after);
      if (changes.length) void write(Model, [{ action: 'UPDATE', entityId: doc._id, label: labelOf(after), changes, tenantId: after.tenantId }]);
    }
    delete doc.$locals.auditIsNew;
    delete doc.$locals.auditBefore;
  });

  // ── insertMany ───────────────────────────────────────────────────────────
  schema.post('insertMany' as any, function (this: any, docs: any) {
    if (!active(this?.collection?.collectionName) || !Array.isArray(docs)) return;
    void write(this, docs.slice(0, MAX_BULK).map((d) => ({ action: 'CREATE' as const, entityId: d._id, label: labelOf(plain(d)), tenantId: d.tenantId })));
  });

  // ── update de um documento por filtro ────────────────────────────────────
  for (const op of UPDATE_OPS) {
    schema.pre(op as any, async function (this: any) {
      if (!active(this.model?.collection?.collectionName)) return;
      this._auditBefore = await this.model.findOne(this.getFilter()).lean();
    });
    schema.post(op as any, async function (this: any) {
      const before = this._auditBefore;
      if (!before || !active(this.model?.collection?.collectionName)) return;
      const after = await this.model.findById(before._id).lean();
      const changes = diffDocs(before, after);
      if (changes.length) void write(this.model, [{ action: 'UPDATE', entityId: before._id, label: labelOf(after ?? before), changes, tenantId: before.tenantId }]);
    });
  }

  // ── updateMany: um registro resumido com os campos alterados ─────────────
  schema.pre('updateMany', async function (this: any) {
    if (!active(this.model?.collection?.collectionName)) return;
    this._auditIds = (await this.model.find(this.getFilter()).select('_id').limit(MAX_BULK).lean()).map((d: any) => d._id);
  });
  schema.post('updateMany', function (this: any, res: any) {
    if (!active(this.model?.collection?.collectionName) || !res?.modifiedCount) return;
    const update = this.getUpdate() ?? {};
    const set = { ...(update.$set ?? {}), ...Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))) };
    const changes = Object.entries(set)
      .filter(([k]) => !IGNORED_FIELDS.has(k))
      .map(([field, to]) => ({ field, from: null, to: summarize(to) }));
    const ids: unknown[] = this._auditIds ?? [];
    void write(this.model, [{ action: 'UPDATE', entityId: ids.length === 1 ? ids[0] : undefined, label: `${res.modifiedCount} registro(s)`, changes, count: res.modifiedCount, snapshot: ids.length > 1 ? { ids: ids.map(String) } : undefined }]);
  });

  // ── exclusões ────────────────────────────────────────────────────────────
  for (const op of DELETE_ONE_OPS) {
    schema.pre(op as any, async function (this: any) {
      if (!active(this.model?.collection?.collectionName)) return;
      this._auditBefore = await this.model.findOne(this.getFilter()).lean();
    });
    schema.post(op as any, function (this: any, res: any) {
      const before = this._auditBefore;
      if (!before || !active(this.model?.collection?.collectionName)) return;
      if (op === 'deleteOne' && res && res.deletedCount === 0) return;
      void write(this.model, [{ action: 'DELETE', entityId: before._id, label: labelOf(before), snapshot: snapshotOf(before), tenantId: before.tenantId }]);
    });
  }
  schema.pre('deleteMany', async function (this: any) {
    if (!active(this.model?.collection?.collectionName)) return;
    this._auditBefore = await this.model.find(this.getFilter()).limit(MAX_BULK).lean();
  });
  schema.post('deleteMany', function (this: any, res: any) {
    const docs: any[] = this._auditBefore ?? [];
    if (!docs.length || !active(this.model?.collection?.collectionName) || res?.deletedCount === 0) return;
    void write(this.model, docs.map((d) => ({ action: 'DELETE' as const, entityId: d._id, label: labelOf(d), snapshot: snapshotOf(d), tenantId: d.tenantId })));
  });
  // doc.deleteOne()
  schema.post('deleteOne', { document: true, query: false }, function (this: any, doc: any) {
    const d = doc ?? this;
    const Model = d?.constructor as any;
    if (!active(Model?.collection?.collectionName)) return;
    const p = plain(d);
    void write(Model, [{ action: 'DELETE', entityId: p._id, label: labelOf(p), snapshot: snapshotOf(p), tenantId: p.tenantId }]);
  });
}
