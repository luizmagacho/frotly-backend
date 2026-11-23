import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';
import { ACTION_LABELS, ENTITY_LABELS } from './audit.labels';

export type AuditQuery = {
  entity?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}

  /** Filtro sempre restrito à locadora do usuário (além do tenantPlugin). */
  private filter(tenantId: string, q: AuditQuery) {
    const f: Record<string, any> = { tenantId: new Types.ObjectId(tenantId) };
    if (q.entity) f.entity = q.entity;
    if (q.action && ['CREATE', 'UPDATE', 'DELETE'].includes(q.action)) f.action = q.action;
    if (q.actorId && Types.ObjectId.isValid(q.actorId)) f.actorId = new Types.ObjectId(q.actorId);
    if (q.entityId) f.entityId = String(q.entityId);
    const range: Record<string, Date> = {};
    // Datas vêm como AAAA-MM-DD; o dia inteiro no horário de Brasília (UTC-3).
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) range.$gte = new Date(`${q.from}T00:00:00-03:00`);
    if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) range.$lte = new Date(`${q.to}T23:59:59.999-03:00`);
    if (Object.keys(range).length) f.createdAt = range;
    if (q.q?.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim().slice(0, 80)), 'i');
      f.$or = [{ label: rx }, { actorName: rx }, { actorEmail: rx }];
    }
    return f;
  }

  async list(tenantId: string, q: AuditQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const f = this.filter(tenantId, q);
    const [data, total] = await Promise.all([
      this.model.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(f),
    ]);
    return { data, total, page, limit, entities: ENTITY_LABELS };
  }

  /** CSV (separador ;, com BOM) para abrir direto no Excel em português. */
  async exportCsv(tenantId: string, q: AuditQuery): Promise<string> {
    const rows = await this.model.find(this.filter(tenantId, q)).sort({ createdAt: -1 }).limit(10_000).lean();
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(d));
    const fmtVal = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    const header = ['Data', 'Usuário', 'E-mail', 'Ação', 'Módulo', 'Registro', 'ID do registro', 'Alterações', 'IP'];
    const lines = rows.map((r) =>
      [
        fmtDate(r.createdAt),
        r.actorName,
        r.actorEmail,
        ACTION_LABELS[r.action] ?? r.action,
        ENTITY_LABELS[r.entity] ?? r.entity,
        r.label,
        r.entityId,
        (r.changes ?? []).map((c) => `${c.field}: ${fmtVal(c.from)} → ${fmtVal(c.to)}`).join(' | '),
        r.ip,
      ]
        .map(cell)
        .join(';'),
    );
    return '﻿' + [header.join(';'), ...lines].join('\r\n');
  }
}
