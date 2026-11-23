/**
 * Contrato comum dos Detrans. Cada UF tem um provedor que traduz a resposta do órgão
 * (via Infosimples) para estes formatos; o resto do sistema não conhece a fonte.
 */

export interface DetranVehicleRef {
  plate: string;
  renavam: string;
  /** CPF (11) ou CNPJ (14) do proprietário, só dígitos. */
  ownerDocument: string;
}

export interface DetranFine {
  noticeNumber: string;
  infractionDate: Date;
  description: string;
  infractionCode?: string;
  location?: string;
  issuingAgency?: string;
  value: number;
  dueDate?: Date;
  paid: boolean;
}

/** Taxa de licenciamento em aberto de um exercício. */
export interface DetranLicensingDebt {
  year: number;
  value: number;
  dueDate?: Date;
}

export interface DetranIpvaQuota {
  number: number;
  amount: number;
  dueDate: Date;
}

export interface DetranIpva {
  year: number;
  /** Parcelas (sem a cota única). */
  quotas: DetranIpvaQuota[];
  /** Valor da cota única, quando oferecida (com desconto). */
  singleQuotaAmount?: number;
  singleQuotaDueDate?: Date;
}

export type DetranService = 'fines' | 'licensing' | 'ipva';

/** Resultado de uma consulta: os dados (ou erro) e quanto ela custou. */
export interface DetranQueryResult<T> {
  ok: boolean;
  data?: T;
  /** Código da Infosimples (200 = ok, 612 = nada encontrado, outros = erro). */
  code: number;
  message?: string;
  billable: boolean;
  price: number;
  /** Nome do serviço na Infosimples (para o registro de uso). */
  service: string;
}

export interface DetranProvider {
  readonly uf: string;
  fines(ref: DetranVehicleRef): Promise<DetranQueryResult<DetranFine[]>>;
  licensing(ref: DetranVehicleRef): Promise<DetranQueryResult<DetranLicensingDebt[]>>;
  ipva(ref: DetranVehicleRef, year: number): Promise<DetranQueryResult<DetranIpva | null>>;
}

/** "R$ 1.234,56" | "1234.56" | 1234.56 → 1234.56 */
export function parseMoney(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[^\d,.-]/g, '');
  if (!s) return undefined;
  // Formato brasileiro (vírgula decimal) ou já normalizado (ponto decimal).
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** "dd/mm/aaaa[ hh:mm]" | "aaaa-mm-dd[Thh:mm]" → Date (meio-dia UTC quando só data, para não virar o dia). */
export function parseDate(v: unknown, time?: unknown): Date | undefined {
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const s = v.trim();
  let y: number, m: number, d: number;
  let rest = '';
  let br = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/.exec(s);
  if (br) {
    [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
    rest = br[4];
  } else {
    const iso = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(s);
    if (!iso) return undefined;
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    rest = iso[4];
  }
  const hm = /(\d{2}):(\d{2})/.exec(typeof time === 'string' && time ? time : rest);
  // Horário de Brasília (UTC-3) quando há hora; sem hora, meio-dia UTC.
  const date = hm ? new Date(Date.UTC(y, m - 1, d, Number(hm[1]) + 3, Number(hm[2]))) : new Date(Date.UTC(y, m - 1, d, 12));
  if (m < 1 || m > 12 || d < 1 || d > 31 || isNaN(date.getTime())) return undefined;
  return date;
}
