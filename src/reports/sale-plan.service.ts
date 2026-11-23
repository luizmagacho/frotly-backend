import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vehicle, VehicleDocument } from '../vehicles/schemas/vehicle.schema';
import { Rental, RentalDocument, RentalStatus, PaymentFrequency } from '../rentals/schemas/rental.schema';
import {
  FinancialEntry,
  FinancialEntryCategory,
  FinancialEntryDocument,
  FinancialEntryType,
} from '../financial-entries/schemas/financial-entry.schema';
import { FipeService } from '../fipe/fipe.service';
import { LlmService } from '../llm/llm.service';
import { ReportsService } from './reports.service';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const HORIZON_WEEKS = 104;

/** Premissas de mercado usadas na projeção (ficam visíveis na resposta). */
export const SALE_PLAN_ASSUMPTIONS = {
  expectedKmPerYear: 15_000, // rodagem "normal" que o mercado espera para a idade do carro
  discountPer10kKmAbove: 0.015, // -1,5% no preço de revenda a cada 10 mil km acima do esperado
  maxKmDiscount: 0.25,
  barrierKm: 100_000, // carro com 100 mil km ou mais perde atratividade na revenda
  barrierDiscount: 0.05,
  maintenanceGrowthFromKm: 80_000, // a partir daqui a manutenção tende a subir
  maintenanceGrowthPer100k: 0.5, // +50% de custo a cada 100 mil km acima disso
  defaultMonthlyDepreciation: 0.008,
};

type Point = { week: number; date: Date; km: number; value: number; cashAccumulated: number; total: number };

const PLAN_SYSTEM = `Você é consultor financeiro de locadoras que alugam carros para motoristas de aplicativo no Brasil.
Recebe números já calculados sobre um veículo (valor FIPE, desvalorização, rodagem semanal, receita e custos) e escreve um plano curto de quando vender o carro.
Regras:
- Use SOMENTE os números fornecidos; não invente valores, datas ou percentuais.
- Escreva em português do Brasil, direto, para o dono da locadora.
- Valores em reais no formato R$ 12.345. Datas no formato mês/ano (ex.: março/2027).
- Responda SOMENTE com JSON válido, sem markdown, neste formato:
{"resumo": "1 ou 2 frases com a situação do carro", "recomendacao": "quando vender e por quê, citando data e km", "pontos": ["3 a 5 itens curtos: riscos, oportunidades e o que acompanhar"]}`;

@Injectable()
export class SalePlanService {
  private readonly log = new Logger(SalePlanService.name);
  private cache = new Map<string, { at: number; data: any }>();

  constructor(
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    @InjectModel(FinancialEntry.name) private financialEntryModel: Model<FinancialEntryDocument>,
    private readonly fipe: FipeService,
    private readonly llm: LlmService,
    private readonly reports: ReportsService,
  ) {}

  /** Desconto de revenda pela quilometragem em relação ao esperado para a idade. */
  static kmDiscount(km: number, ageYears: number): number {
    const a = SALE_PLAN_ASSUMPTIONS;
    const expected = Math.max(ageYears, 0.5) * a.expectedKmPerYear;
    let d = ((km - expected) / 10_000) * a.discountPer10kKmAbove;
    // Rodar pouco não faz o carro valer acima da FIPE na revenda para locadora.
    d = Math.min(a.maxKmDiscount, Math.max(0, d));
    if (km >= a.barrierKm) d += a.barrierDiscount;
    return d;
  }

  /** Desvalorização mensal média pelo histórico da FIPE (até 12 meses). */
  static monthlyDepreciation(history: { price: number }[]): number {
    const n = Math.min(12, history.length - 1);
    if (n < 3 || !history[n]?.price || !history[0]?.price) return SALE_PLAN_ASSUMPTIONS.defaultMonthlyDepreciation;
    const rate = 1 - Math.pow(history[0].price / history[n].price, 1 / n);
    return Math.min(0.04, Math.max(0, rate));
  }

  static weeklyRent(amount: number, frequency: PaymentFrequency): number {
    if (frequency === PaymentFrequency.BIWEEKLY) return amount / 2;
    if (frequency === PaymentFrequency.MONTHLY) return (amount * 12) / 52;
    return amount;
  }

  async getPlan(vehicleId: string, tenantKey: string, refresh = false) {
    if (!Types.ObjectId.isValid(vehicleId)) throw new NotFoundException('Veículo não encontrado.');
    const cacheKey = `${tenantKey}:${vehicleId}`;
    const hit = this.cache.get(cacheKey);
    if (!refresh && hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.data;

    const vehicle: any = await this.vehicleModel.findById(vehicleId).lean();
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');

    const base = {
      vehicle: {
        id: vehicle._id,
        licensePlate: vehicle.licensePlate,
        name: `${vehicle.brand ?? ''} ${vehicle.model ?? ''} ${vehicle.modelYear ?? vehicle.year ?? ''}`.trim(),
        fipeCode: vehicle.fipeCode ?? null,
        fipeModelName: vehicle.fipeModelName ?? null,
      },
    };
    if (!vehicle.fipeCode || !vehicle.fipeYearCode) return { ...base, needsFipe: true };

    const now = new Date();
    const [quote, readingsBy, rental, costs, rentIncome] = await Promise.all([
      this.fipe.quote(vehicle.fipeCode, vehicle.fipeYearCode),
      this.reports.collectReadings(now),
      this.rentalModel
        .findOne({ vehicleId: vehicle._id, status: { $in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] } })
        .select('rentalAmount paymentFrequency weeklyKmLimit')
        .lean(),
      this.sumEntries(vehicle._id, FinancialEntryType.EXPENSE, 180),
      this.sumEntries(vehicle._id, FinancialEntryType.INCOME, 90, FinancialEntryCategory.ALUGUEL),
    ]);

    // Rodagem semanal: últimos 90 dias de leituras (reporte do motorista + tela de km).
    const readings = readingsBy.get(String(vehicle._id)) ?? [];
    const kmNow = Math.max(vehicle.mileage || 0, ...readings.map((r) => r.mileage));
    const pace = ReportsService.kmBetween(readings, new Date(now.getTime() - 90 * DAY), now);
    const kmPerWeek = Math.round(pace.km / (90 / 7));

    const weeklyRevenue = rental
      ? SalePlanService.weeklyRent((rental as any).rentalAmount, (rental as any).paymentFrequency)
      : rentIncome / (90 / 7);
    const weeklyCost = costs / (180 / 7); // sem combustível (é do motorista)

    const monthlyDep = SalePlanService.monthlyDepreciation(quote.history);
    const modelYear = quote.modelYear < 3000 ? quote.modelYear : now.getFullYear(); // 32000 = 0 km na FIPE
    const ageNow = Math.max(0, (now.getTime() - new Date(modelYear - 1, 6, 1).getTime()) / (365.25 * DAY));
    const a = SALE_PLAN_ASSUMPTIONS;

    const valueAt = (km: number, weeks: number) => {
      const months = (weeks * 7) / 30.44;
      const fipeAt = quote.price * Math.pow(1 - monthlyDep, months);
      return fipeAt * (1 - SalePlanService.kmDiscount(km, ageNow + months / 12));
    };
    const costFactor = (km: number) =>
      1 + (Math.max(0, km - a.maintenanceGrowthFromKm) / 100_000) * a.maintenanceGrowthPer100k;

    const points: Point[] = [];
    let cash = 0;
    for (let w = 0; w <= HORIZON_WEEKS; w++) {
      const km = kmNow + kmPerWeek * w;
      if (w > 0) cash += weeklyRevenue - weeklyCost * costFactor(km);
      const value = valueAt(km, w);
      points.push({ week: w, date: new Date(now.getTime() + w * WEEK), km: Math.round(km), value: Math.round(value), cashAccumulated: Math.round(cash), total: Math.round(value + cash) });
    }

    // Melhor momento = semana que maximiza (valor de venda + caixa acumulado até lá).
    const best = points.reduce((b, p) => (p.total > b.total ? p : b), points[0]);
    const weeksTo100k =
      kmNow < a.barrierKm && kmPerWeek > 0 ? Math.ceil((a.barrierKm - kmNow) / kmPerWeek) : null;
    const pick = (w: number) => points[Math.min(w, HORIZON_WEEKS)];
    const scenarios = [0, 13, 26, 52].map((w) => {
      const p = pick(w);
      return { label: w === 0 ? 'Vender agora' : `Vender em ${Math.round(w / 4.345)} meses`, ...p, gainVsNow: p.total - points[0].total };
    });
    const weeklyDepreciationNow = Math.round(points[0].value - points[1].value);

    // Recomendação: vender já, no pico econômico (se houver dentro de 2 anos) ou, se o carro
    // seguir lucrativo, um mês antes de chegar aos 100 mil km — ponto em que a revenda fica
    // mais difícil e a manutenção pesa. Sem esse marco no horizonte, manter e reavaliar.
    let reason: 'agora' | 'pico' | 'antes_100k' | 'manter';
    let rec: Point;
    if (best.week === 0) { reason = 'agora'; rec = points[0]; }
    else if (best.week < HORIZON_WEEKS) { reason = 'pico'; rec = best; }
    else if (weeksTo100k != null && weeksTo100k <= HORIZON_WEEKS) { reason = 'antes_100k'; rec = pick(Math.max(1, weeksTo100k - 4)); }
    else { reason = 'manter'; rec = points[HORIZON_WEEKS]; }
    const recommended = { ...rec, reason, gainVsNow: rec.total - points[0].total };

    const computed = {
      fipe: {
        price: quote.price,
        referenceMonth: quote.referenceMonth,
        model: `${quote.brand} ${quote.model} ${quote.modelYear < 3000 ? quote.modelYear : '0 km'}`,
        monthlyDepreciationPct: Math.round(monthlyDep * 1000) / 10,
        history: quote.history.slice(0, 13).reverse(),
      },
      kmNow,
      kmPerWeek,
      weeklyKmLimit: (rental as any)?.weeklyKmLimit ?? null,
      readingsUsed: pace.readings,
      weeklyRevenue: Math.round(weeklyRevenue),
      weeklyCost: Math.round(weeklyCost),
      weeklyDepreciationNow,
      weeklyNetNow: Math.round(weeklyRevenue - weeklyCost - weeklyDepreciationNow),
      estimatedSaleValueNow: points[0].value,
      recommended,
      weeksTo100k,
      dateAt100k: weeksTo100k != null ? new Date(now.getTime() + weeksTo100k * WEEK) : null,
      scenarios,
      curve: points.filter((p) => p.week % 4 === 0),
      assumptions: a,
    };

    const narrative = await this.narrative(base.vehicle, computed);
    const data = { ...base, needsFipe: false, generatedAt: now, ...computed, ...narrative };
    this.cache.set(cacheKey, { at: Date.now(), data });
    return data;
  }

  private async sumEntries(vehicleId: Types.ObjectId, type: FinancialEntryType, days: number, category?: FinancialEntryCategory) {
    const match: any = { vehicleId, type, date: { $gt: new Date(Date.now() - days * DAY) } };
    match.category = category ?? { $ne: FinancialEntryCategory.COMBUSTIVEL };
    const [r] = await this.financialEntryModel.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    return r?.total ?? 0;
  }

  private async narrative(vehicle: any, c: any): Promise<{ ai: { resumo: string; recomendacao: string; pontos: string[] }; aiSource: 'llm' | 'regras' }> {
    const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
    const mes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (this.llm.isConfigured()) {
      try {
        const facts = {
          veiculo: `${vehicle.name} (${vehicle.licensePlate})`,
          fipe_atual: brl(c.fipe.price),
          mes_referencia_fipe: c.fipe.referenceMonth,
          desvalorizacao_fipe_ao_mes: `${String(c.fipe.monthlyDepreciationPct).replace('.', ',')}%`,
          km_atual: c.kmNow,
          km_por_semana: c.kmPerWeek,
          limite_km_semana_contrato: c.weeklyKmLimit,
          valor_estimado_de_venda_hoje: brl(c.estimatedSaleValueNow),
          receita_semanal_aluguel: brl(c.weeklyRevenue),
          custo_semanal_sem_combustivel: brl(c.weeklyCost),
          perda_de_valor_por_semana_hoje: brl(c.weeklyDepreciationNow),
          lucro_liquido_semanal_hoje: brl(c.weeklyNetNow),
          momento_recomendado: {
            agora: 'vender agora: manter já custa mais (desvalorização + manutenção) do que o aluguel rende',
            pico: `vender em ${mes(new Date(c.recommended.date))}, com cerca de ${c.recommended.km.toLocaleString('pt-BR')} km: depois disso manter passa a dar menos resultado`,
            antes_100k: `vender em ${mes(new Date(c.recommended.date))}, com cerca de ${c.recommended.km.toLocaleString('pt-BR')} km, um mês antes de chegar a 100 mil km; até lá o carro segue lucrativo`,
            manter: 'manter: no ritmo atual segue lucrativo e não chega a 100 mil km em 2 anos; reavaliar a cada trimestre',
          }[c.recommended.reason as string],
          valor_estimado_de_venda_no_momento_recomendado: brl(c.recommended.value),
          aluguel_liquido_acumulado_ate_la: brl(c.recommended.cashAccumulated),
          ganho_vs_vender_hoje: brl(c.recommended.gainVsNow),
          chega_a_100_mil_km_em: c.dateAt100k ? mes(new Date(c.dateAt100k)) : 'não chega em 2 anos ou já passou',
          cenarios: c.scenarios.map((s: any) => `${s.label}: venda ${brl(s.value)}, caixa do aluguel até lá ${brl(s.cashAccumulated)}, resultado vs vender hoje ${brl(s.gainVsNow)}`),
          observacao_mercado: 'A FIPE costuma cair quando entra o novo ano-modelo (início do ano).',
        };
        const out = await this.llm.completeJson<{ resumo: string; recomendacao: string; pontos: string[] }>(
          PLAN_SYSTEM,
          JSON.stringify(facts),
        );
        if (out?.resumo && out?.recomendacao) {
          return { ai: { resumo: out.resumo, recomendacao: out.recomendacao, pontos: (out.pontos ?? []).slice(0, 5) }, aiSource: 'llm' };
        }
      } catch (e: any) {
        this.log.warn(`Plano de venda: LLM indisponível, usando regras (${e?.message})`);
      }
    }

    // Sem IA (ou falhou): texto montado pelas regras, com os mesmos números.
    const pontos = [
      `Hoje o carro vale cerca de ${brl(c.estimatedSaleValueNow)} na revenda e perde ${brl(c.weeklyDepreciationNow)} por semana.`,
      `O aluguel rende ${brl(c.weeklyRevenue)}/semana e os custos (sem combustível) somam ${brl(c.weeklyCost)}/semana.`,
    ];
    if (c.dateAt100k) pontos.push(`No ritmo de ${c.kmPerWeek.toLocaleString('pt-BR')} km/semana, chega a 100 mil km em ${mes(new Date(c.dateAt100k))} — a partir daí a revenda fica mais difícil.`);
    pontos.push('A FIPE costuma cair na virada do ano-modelo, no início do ano.');
    const r = c.recommended;
    const quando = `${mes(new Date(r.date))}, com cerca de ${r.km.toLocaleString('pt-BR')} km, por aproximadamente ${brl(r.value)}`;
    const recomendacao = {
      agora: 'Vender agora: manter o carro já custa mais em desvalorização e manutenção do que o aluguel rende.',
      pico: `Vender por volta de ${quando} — ${brl(r.gainVsNow)} a mais do que vender hoje, somando o aluguel recebido até lá.`,
      antes_100k: `Manter até ${quando}, um mês antes dos 100 mil km. Até lá o aluguel soma ${brl(r.cashAccumulated)} líquidos.`,
      manter: 'Manter: no ritmo atual o carro segue lucrativo e não chega a 100 mil km em 2 anos. Reavalie a cada trimestre.',
    }[r.reason as string] as string;
    return {
      ai: {
        resumo: `${vehicle.name} com ${c.kmNow.toLocaleString('pt-BR')} km, FIPE de ${brl(c.fipe.price)} (${String(c.fipe.monthlyDepreciationPct).replace('.', ',')}% de queda ao mês).`,
        recomendacao,
        pontos,
      },
      aiSource: 'regras',
    };
  }
}
