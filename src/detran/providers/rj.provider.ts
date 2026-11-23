import { Injectable } from '@nestjs/common';
import { InfosimplesClient, InfosimplesResponse, NO_RESULT_CODES } from './infosimples.client';
import {
  DetranFine,
  DetranIpva,
  DetranIpvaQuota,
  DetranLicensingDebt,
  DetranProvider,
  DetranQueryResult,
  DetranVehicleRef,
  parseDate,
  parseMoney,
} from './detran-provider';

export const RJ_SERVICES = {
  fines: 'detran/rj/nada-consta',
  licensing: 'detran/rj/grt',
  ipva: 'sefaz/rj/ipva/darj',
} as const;

const docParams = (doc: string) => (doc.length === 14 ? { cnpj: doc } : { cpf: doc });
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** Primeiro campo cujo nome casa com o padrão (prefere a versão normalizado_*). */
function pick(obj: Record<string, any>, pattern: RegExp): unknown {
  const keys = Object.keys(obj ?? {}).filter((k) => pattern.test(k));
  const norm = keys.find((k) => k.startsWith('normalizado_') && obj[k] != null && obj[k] !== '');
  const plain = keys.find((k) => obj[k] != null && obj[k] !== '');
  return norm ? obj[norm] : plain ? obj[plain] : undefined;
}

function result<T>(service: string, r: InfosimplesResponse, map: (data: any[]) => T, empty: T): DetranQueryResult<T> {
  const base = { code: r.code, billable: r.billable, price: r.price, service };
  if (r.code === 200) return { ...base, ok: true, data: map(r.data) };
  if (NO_RESULT_CODES.has(r.code)) return { ...base, ok: true, data: empty, message: r.message };
  return { ...base, ok: false, message: [r.message, ...r.errors].filter(Boolean).join(' ') };
}

/** Multas do "Nada Consta" do Detran-RJ. */
export function mapRjFines(data: any[]): DetranFine[] {
  const out: DetranFine[] = [];
  for (const block of data ?? []) {
    for (const m of block?.multas ?? []) {
      const noticeNumber = str(m.auto_de_infracao) || str(m.auto_de_renainf);
      const infractionDate = parseDate(m.normalizado_data_infracao ?? m.data_infracao, m.hora);
      const value = parseMoney(m.normalizado_valor_a_ser_pago ?? m.valor_a_ser_pago) ?? parseMoney(m.normalizado_valor_original ?? m.valor_original);
      if (!noticeNumber || !infractionDate || value === undefined) continue;
      const payment = `${str(m.status_de_pagamento)} ${str(m.situacao)}`.toLowerCase();
      const paid = /\bpag[ao]\b|quitad/.test(payment) && !/n[aã]o\s+pag|em aberto|a pagar/.test(payment);
      out.push({
        noticeNumber,
        infractionDate,
        description: str(m.descricao) || 'Infração de trânsito',
        infractionCode: str(m.enquadramento_da_infracao) || undefined,
        location: str(m.local_da_infracao) || undefined,
        issuingAgency: str(m.orgao_emissor) || str(m.agente_emissor) || undefined,
        value,
        dueDate: parseDate(m.normalizado_data_pagamento_com_desconto ?? m.data_pagamento_com_desconto),
        paid,
      });
    }
  }
  return out;
}

/** Taxas em aberto (GRT) por exercício. O formato das cotas não é documentado: lê valor e vencimento pelo nome. */
export function mapRjLicensing(data: any[]): DetranLicensingDebt[] {
  const out: DetranLicensingDebt[] = [];
  for (const block of data ?? []) {
    for (const ex of block?.exercicios ?? []) {
      const year = Number(str(ex.exercicio).replace(/\D/g, '').slice(0, 4));
      if (!year) continue;
      const cotas: any[] = Array.isArray(ex.cotas) ? ex.cotas : [];
      let value = 0;
      let dueDate: Date | undefined;
      for (const c of cotas) {
        value += parseMoney(pick(c, /valor_a_pagar|valor_total/)) ?? parseMoney(pick(c, /^(normalizado_)?valor$/)) ?? parseMoney(pick(c, /valor/)) ?? 0;
        const d = parseDate(pick(c, /vencimento/));
        if (d && (!dueDate || d < dueDate)) dueDate = d;
      }
      if (!cotas.length) value = parseMoney(pick(ex, /valor/)) ?? 0;
      if (value > 0) out.push({ year, value: Math.round(value * 100) / 100, dueDate: dueDate ?? parseDate(pick(ex, /vencimento/)) });
    }
  }
  return out;
}

/** Cotas do DARJ do IPVA (SEFAZ-RJ). A cota única vira desconto; as demais, parcelas. */
export function mapRjIpva(data: any[], year: number): DetranIpva | null {
  const cotas: any[] = (data ?? []).flatMap((b) => (Array.isArray(b?.cotas) ? b.cotas : []));
  if (!cotas.length) return null;
  const quotas: DetranIpvaQuota[] = [];
  let single: { amount: number; dueDate?: Date } | undefined;
  for (const c of cotas) {
    const label = str(c.cota).toLowerCase();
    const amount = parseMoney(c.normalizado_valor_a_pagar ?? c.valor_a_pagar) ?? parseMoney(c.normalizado_valor_principal ?? c.valor_principal);
    const dueDate = parseDate(c.normalizado_data_vencimento ?? c.data_vencimento);
    if (amount === undefined || !dueDate) continue;
    if (/[uú]nica/.test(label)) single = { amount, dueDate };
    else quotas.push({ number: Number(label.replace(/\D/g, '')) || quotas.length + 1, amount, dueDate });
  }
  if (!quotas.length && single) quotas.push({ number: 1, amount: single.amount, dueDate: single.dueDate! });
  if (!quotas.length) return null;
  quotas.sort((a, b) => a.number - b.number);
  return { year, quotas, singleQuotaAmount: single?.amount, singleQuotaDueDate: single?.dueDate };
}

@Injectable()
export class RjDetranProvider implements DetranProvider {
  readonly uf = 'RJ';

  constructor(private readonly client: InfosimplesClient) {}

  async fines(ref: DetranVehicleRef) {
    const r = await this.client.query(RJ_SERVICES.fines, { renavam: ref.renavam, ...docParams(ref.ownerDocument) });
    return result(RJ_SERVICES.fines, r, mapRjFines, []);
  }

  async licensing(ref: DetranVehicleRef) {
    const r = await this.client.query(RJ_SERVICES.licensing, { renavam: ref.renavam, ...docParams(ref.ownerDocument) });
    return result(RJ_SERVICES.licensing, r, mapRjLicensing, []);
  }

  async ipva(ref: DetranVehicleRef, year: number) {
    const r = await this.client.query(RJ_SERVICES.ipva, { renavam: ref.renavam, ano: year });
    return result(RJ_SERVICES.ipva, r, (d) => mapRjIpva(d, year), null);
  }
}
