import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InfosimplesResponse {
  code: number;
  message: string;
  data: any[];
  billable: boolean;
  price: number;
  errors: string[];
}

/** Códigos da Infosimples que significam "consultou e não achou nada" (ex.: nada consta). */
export const NO_RESULT_CODES = new Set([612]);

/**
 * Cliente HTTP da Infosimples (https://api.infosimples.com/api/v2/consultas/<serviço>).
 * Cada chamada pode ser cobrada; quem decide quando chamar é o DetranSyncService.
 */
@Injectable()
export class InfosimplesClient {
  private readonly logger = new Logger(InfosimplesClient.name);
  constructor(private readonly config: ConfigService) {}

  /** INFOSIMPLES_BASE_URL só para testes locais (servidor falso). */
  private get baseUrl(): string {
    return this.config.get<string>('INFOSIMPLES_BASE_URL') || 'https://api.infosimples.com/api/v2/consultas';
  }

  get configured(): boolean {
    return !!this.config.get<string>('INFOSIMPLES_TOKEN');
  }

  async query(service: string, params: Record<string, string | number | undefined>): Promise<InfosimplesResponse> {
    const token = this.config.get<string>('INFOSIMPLES_TOKEN');
    if (!token) return { code: -1, message: 'INFOSIMPLES_TOKEN não configurado.', data: [], billable: false, price: 0, errors: [] };

    const body = new URLSearchParams({ token, timeout: '300' });
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') body.set(k, String(v));

    try {
      const res = await fetch(`${this.baseUrl}/${service}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(330_000),
      });
      const json: any = await res.json();
      const header = json?.header ?? {};
      return {
        code: Number(json?.code ?? res.status),
        message: String(json?.code_message ?? ''),
        data: Array.isArray(json?.data) ? json.data : [],
        billable: header.billable === true,
        price: Number(header.price ?? 0) || 0,
        errors: Array.isArray(json?.errors) ? json.errors.map(String) : [],
      };
    } catch (err: any) {
      this.logger.warn(`Infosimples ${service} falhou: ${err?.message ?? err}`);
      return { code: -2, message: `Falha de conexão com a Infosimples: ${err?.message ?? err}`, data: [], billable: false, price: 0, errors: [] };
    }
  }
}
