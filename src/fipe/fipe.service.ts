import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Tabela FIPE via API pública da Parallelum (gratuita, ~1.000 consultas/dia sem token).
 * As respostas mudam no máximo uma vez por mês, então ficam em cache em memória.
 * Se FIPE_API_TOKEN estiver definido, é enviado para ganhar mais cota.
 */
export type FipeOption = { code: string; name: string };
export type FipePrice = { price: number; month: string };
export type FipeQuote = {
  fipeCode: string;
  model: string;
  brand: string;
  modelYear: number;
  fuel: string;
  price: number;
  referenceMonth: string;
  history: FipePrice[]; // mais recente primeiro
};

const BASE = 'https://fipe.parallelum.com.br/api/v2/cars';
const TTL = 12 * 60 * 60 * 1000;

export function parseBRL(v: string): number {
  return Number(String(v).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

@Injectable()
export class FipeService {
  private readonly log = new Logger(FipeService.name);
  private cache = new Map<string, { at: number; data: unknown }>();

  private async get<T>(path: string): Promise<T> {
    const hit = this.cache.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.data as T;
    try {
      const token = process.env.FIPE_API_TOKEN;
      const res = await axios.get<T>(`${BASE}${path}`, {
        timeout: 15_000,
        headers: token ? { 'X-Subscription-Token': token } : undefined,
      });
      this.cache.set(path, { at: Date.now(), data: res.data });
      return res.data;
    } catch (e: any) {
      this.log.warn(`FIPE ${path} falhou: ${e?.response?.status ?? e?.message}`);
      throw new BadGatewayException('Não foi possível consultar a tabela FIPE agora. Tente novamente em instantes.');
    }
  }

  brands() {
    return this.get<FipeOption[]>('/brands');
  }

  models(brand: string) {
    return this.get<FipeOption[]>(`/brands/${encodeURIComponent(brand)}/models`);
  }

  years(brand: string, model: string) {
    return this.get<FipeOption[]>(`/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/years`);
  }

  /** Código FIPE + nome da versão para a escolha marca/modelo/ano. */
  async resolve(brand: string, model: string, year: string) {
    const r = await this.get<any>(
      `/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/years/${encodeURIComponent(year)}`,
    );
    return { fipeCode: r.codeFipe as string, fipeYearCode: year, fipeModelName: `${r.brand} ${r.model} ${r.modelYear}`, price: parseBRL(r.price), referenceMonth: r.referenceMonth as string };
  }

  /** Preço atual e histórico mensal de uma versão/ano. */
  async quote(fipeCode: string, yearCode: string): Promise<FipeQuote> {
    const r = await this.get<any>(`/${encodeURIComponent(fipeCode)}/years/${encodeURIComponent(yearCode)}/history`);
    const history: FipePrice[] = (r.priceHistory ?? []).map((h: any) => ({ price: parseBRL(h.price), month: h.month }));
    return {
      fipeCode: r.codeFipe,
      model: r.model,
      brand: r.brand,
      modelYear: r.modelYear,
      fuel: r.fuel,
      price: history[0]?.price ?? 0,
      referenceMonth: history[0]?.month ?? '',
      history,
    };
  }
}
