import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { tenantContext } from '../common/tenant.context';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { Fine, FineDocument, FineStatus } from '../fines/schemas/fine.schema';
import { FinesService } from '../fines/fines.service';
import { Licensing } from '../licensing/schemas/licensing.schema';
import { LicensingService } from '../licensing/licensing.service';
import { Ipva, IpvaDocument, IpvaStatus } from '../ipva/schemas/ipva.schema';
import { FinancialEntriesService } from '../financial-entries/financial-entries.service';
import { FinancialEntryCategory, FinancialEntryStatus, FinancialEntryType } from '../financial-entries/schemas/financial-entry.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { DetranQuery, DetranQueryDocument } from './schemas/detran-query.schema';
import { DetranFine, DetranIpva, DetranLicensingDebt, DetranProvider, DetranQueryResult, DetranService, DetranVehicleRef } from './providers/detran-provider';
import { RjDetranProvider } from './providers/rj.provider';
import { InfosimplesClient } from './providers/infosimples.client';

export type SyncTrigger = 'CRON' | 'MANUAL' | 'SCRIPT';
const INACTIVE = new Set(['INACTIVE', 'INATIVO']);
const MANUAL_COOLDOWN_MS = 24 * 3600_000;
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isoDay = (d?: Date) => (d ? d.toISOString().slice(0, 10) : undefined);

/** Início do mês corrente no horário de Brasília (UTC-3). */
function monthStart(now = new Date()): Date {
  const br = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3));
}

export interface VehicleSyncSummary {
  vehicleId: string;
  plate: string;
  skipped?: string;
  results: { kind: DetranService; ok: boolean; message?: string; summary?: Record<string, unknown>; skipped?: string }[];
}

/**
 * Consulta automática ao Detran (multas toda segunda, licenciamento e IPVA no dia 2 de
 * cada mês) para as locadoras com `detranSyncEnabled`. Cada consulta tem custo, então:
 *  - só veículos com UF atendida, RENAVAM e documento do proprietário;
 *  - teto mensal de consultas cobradas (INFOSIMPLES_MONTHLY_LIMIT, padrão 450 ≈ R$ 100);
 *  - licenciamento/IPVA não são consultados se o ano corrente já está registrado;
 *  - "Consultar agora" no máximo uma vez a cada 24 h por veículo.
 * Só cria registros novos (multas em aberto, licenciamento e IPVA do ano) e marca como
 * pagas as multas que o Detran mostra pagas. Nada é apagado.
 */
@Injectable()
export class DetranSyncService {
  private readonly logger = new Logger(DetranSyncService.name);
  private readonly providers: Record<string, DetranProvider>;
  private running = false;

  constructor(
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<any>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<any>,
    @InjectModel(Fine.name) private readonly fineModel: Model<FineDocument>,
    @InjectModel(Licensing.name) private readonly licensingModel: Model<any>,
    @InjectModel(Ipva.name) private readonly ipvaModel: Model<IpvaDocument>,
    @InjectModel(DetranQuery.name) private readonly queryModel: Model<DetranQueryDocument>,
    private readonly finesService: FinesService,
    private readonly licensingService: LicensingService,
    private readonly financialEntriesService: FinancialEntriesService,
    private readonly notificationsService: NotificationsService,
    private readonly client: InfosimplesClient,
    private readonly config: ConfigService,
    rj: RjDetranProvider,
  ) {
    this.providers = { [rj.uf]: rj };
  }

  get supportedUfs(): string[] {
    return Object.keys(this.providers);
  }

  get monthlyLimit(): number {
    const n = Number(this.config.get('INFOSIMPLES_MONTHLY_LIMIT'));
    return Number.isFinite(n) && n > 0 ? n : 450;
  }

  /** Consultas cobradas no mês (todas as locadoras: o custo é da Frotly). */
  async usageThisMonth(): Promise<{ queries: number; billable: number; cost: number; limit: number; since: Date }> {
    const since = monthStart();
    const [agg] = await this.queryModel.collection
      .aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: null, queries: { $sum: 1 }, billable: { $sum: { $cond: ['$billable', 1, 0] } }, cost: { $sum: '$price' } } },
      ])
      .toArray();
    return { queries: agg?.queries ?? 0, billable: agg?.billable ?? 0, cost: Math.round((agg?.cost ?? 0) * 100) / 100, limit: this.monthlyLimit, since };
  }

  // ---------- crons ----------

  @Cron('0 7 * * 1', { name: 'detran-fines', timeZone: 'America/Sao_Paulo' })
  async weeklyFines() {
    if (this.cronEnabled()) await this.runAll(['fines'], 'CRON');
  }

  @Cron('30 7 2 * *', { name: 'detran-licensing-ipva', timeZone: 'America/Sao_Paulo' })
  async monthlyLicensingIpva() {
    if (this.cronEnabled()) await this.runAll(['licensing', 'ipva'], 'CRON');
  }

  private cronEnabled() {
    return this.client.configured && this.config.get('DETRAN_SYNC_CRON') !== 'off';
  }

  /** Roda para todas as locadoras ligadas (ou uma, via script). */
  async runAll(kinds: DetranService[], trigger: SyncTrigger, onlyTenantId?: string): Promise<VehicleSyncSummary[]> {
    if (this.running) {
      this.logger.warn('Consulta ao Detran já em andamento; ignorando nova execução.');
      return [];
    }
    this.running = true;
    const out: VehicleSyncSummary[] = [];
    try {
      const filter: any = { detranSyncEnabled: true, isActive: { $ne: false } };
      if (onlyTenantId) filter._id = new Types.ObjectId(onlyTenantId);
      const tenants = await this.tenantModel.find(filter).lean();
      for (const tenant of tenants) {
        const vehicles = await this.vehicleModel.find({ tenantId: tenant._id, uf: { $in: this.supportedUfs } }).lean();
        for (const v of vehicles) {
          const res = await this.syncVehicle(tenant, v, kinds, trigger);
          out.push(res);
          if (res.results.some((r) => r.skipped === 'limit')) {
            this.logger.warn(`Teto mensal de consultas ao Detran atingido (${this.monthlyLimit}). Parando.`);
            return out;
          }
        }
      }
      const done = out.flatMap((o) => o.results).filter((r) => !r.skipped);
      this.logger.log(`Detran (${kinds.join(', ')}): ${done.length} consulta(s) em ${out.length} veículo(s).`);
      return out;
    } finally {
      this.running = false;
    }
  }

  // ---------- "Consultar agora" ----------

  async syncNow(tenantId: string, vehicleId: string): Promise<VehicleSyncSummary> {
    if (!Types.ObjectId.isValid(vehicleId)) throw new NotFoundException('Veículo não encontrado.');
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant?.detranSyncEnabled) {
      throw new ForbiddenException('A consulta ao Detran não está ativa para a sua locadora. Fale com o suporte da Frotly para ativar.');
    }
    const vehicle = await this.vehicleModel.findOne({ _id: new Types.ObjectId(vehicleId), tenantId: tenant._id }).lean();
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const reason = this.ineligible(vehicle, tenant);
    if (reason) throw new BadRequestException(reason);

    const last = await this.queryModel
      .findOne({ tenantId: tenant._id, vehicleId: vehicle._id, kind: 'fines', ok: true })
      .sort({ createdAt: -1 })
      .lean();
    if (last?.createdAt && Date.now() - new Date(last.createdAt).getTime() < MANUAL_COOLDOWN_MS) {
      const at = new Date(last.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
      throw new BadRequestException(`Este veículo já foi consultado em ${at}. Cada consulta tem custo, então dá para consultar de novo 24 h depois.`);
    }
    return this.syncVehicle(tenant, vehicle, ['fines'], 'MANUAL');
  }

  // ---------- status para a tela ----------

  async status(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).select('detranSyncEnabled cnpj').lean();
    const vehicles = await this.vehicleModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .select('licensePlate brand model uf renavam ownerDocument status')
      .sort({ licensePlate: 1 })
      .lean();
    const supported = vehicles.filter((v: any) => this.supportedUfs.includes(v.uf));
    const lasts = await this.queryModel
      .aggregate([
        { $match: { tenantId: new Types.ObjectId(tenantId), kind: 'fines' } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$vehicleId', at: { $first: '$createdAt' }, ok: { $first: '$ok' }, message: { $first: '$message' }, summary: { $first: '$summary' } } },
      ])
      .exec();
    const lastBy = new Map(lasts.map((l: any) => [String(l._id), l]));
    return {
      enabled: !!tenant?.detranSyncEnabled,
      supportedUfs: this.supportedUfs,
      withoutUf: vehicles.filter((v: any) => !v.uf).length,
      vehicles: supported.map((v: any) => {
        const last: any = lastBy.get(String(v._id));
        return {
          id: String(v._id),
          plate: v.licensePlate,
          name: `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
          uf: v.uf,
          problem: tenant ? this.ineligible(v, tenant) : 'Locadora não encontrada.',
          lastCheck: last ? { at: last.at, ok: last.ok, message: last.ok ? undefined : last.message, summary: last.summary } : null,
        };
      }),
    };
  }

  // ---------- núcleo ----------

  private ownerDocument(vehicle: any, tenant: any): string {
    const own = String(vehicle.ownerDocument ?? '').replace(/\D/g, '');
    if (own.length === 11 || own.length === 14) return own;
    const cnpj = String(tenant?.cnpj ?? '').replace(/\D/g, '');
    return cnpj.length === 14 ? cnpj : '';
  }

  /** Motivo para não consultar o veículo (ou null se pode). */
  private ineligible(vehicle: any, tenant: any): string | null {
    if (!this.providers[vehicle.uf]) return `A consulta automática ainda não atende veículos de ${vehicle.uf || 'UF não informada'}.`;
    if (INACTIVE.has(vehicle.status)) return 'Veículo inativo.';
    const renavam = String(vehicle.renavam ?? '').replace(/\D/g, '');
    if (renavam.length < 9) return 'Cadastre o RENAVAM do veículo.';
    if (!this.ownerDocument(vehicle, tenant)) return 'Informe o CPF/CNPJ do proprietário no veículo ou o CNPJ da locadora em Configurações.';
    return null;
  }

  async syncVehicle(tenant: any, vehicle: any, kinds: DetranService[], trigger: SyncTrigger): Promise<VehicleSyncSummary> {
    const summary: VehicleSyncSummary = { vehicleId: String(vehicle._id), plate: vehicle.licensePlate, results: [] };
    const reason = this.ineligible(vehicle, tenant);
    if (reason) {
      summary.skipped = reason;
      return summary;
    }
    const provider = this.providers[vehicle.uf];
    const ref: DetranVehicleRef = {
      plate: vehicle.licensePlate,
      renavam: String(vehicle.renavam).replace(/\D/g, ''),
      ownerDocument: this.ownerDocument(vehicle, tenant),
    };
    const tenantId = String(tenant._id);
    const year = Number(new Date(Date.now() - 3 * 3600_000).getUTCFullYear());

    for (const kind of kinds) {
      const skip = await this.shouldSkip(kind, tenantId, vehicle._id, year);
      if (skip) {
        summary.results.push({ kind, ok: true, skipped: skip });
        continue;
      }
      const usage = await this.usageThisMonth();
      if (usage.billable >= usage.limit) {
        summary.results.push({ kind, ok: false, skipped: 'limit', message: `Teto mensal de ${usage.limit} consultas atingido.` });
        break;
      }

      let res: DetranQueryResult<any>;
      if (kind === 'fines') res = await provider.fines(ref);
      else if (kind === 'licensing') res = await provider.licensing(ref);
      else res = await provider.ipva(ref, year);

      let applied: Record<string, unknown> | undefined;
      if (res.ok) {
        try {
          applied = await tenantContext.run({ tenantId }, () => {
            if (kind === 'fines') return this.applyFines(tenantId, vehicle, res.data as DetranFine[]);
            if (kind === 'licensing') return this.applyLicensing(tenantId, vehicle, res.data as DetranLicensingDebt[]);
            return this.applyIpva(tenantId, vehicle, res.data as DetranIpva | null);
          });
        } catch (err: any) {
          this.logger.error(`Detran ${kind} ${vehicle.licensePlate}: erro ao gravar: ${err?.message}`);
          res = { ...res, ok: false, message: `Consultou, mas falhou ao gravar: ${err?.message}` };
        }
      }

      await this.queryModel.collection.insertOne({
        tenantId: tenant._id,
        vehicleId: vehicle._id,
        plate: vehicle.licensePlate,
        uf: vehicle.uf,
        kind,
        service: res.service,
        trigger,
        code: res.code,
        ok: res.ok,
        message: res.message,
        billable: res.billable,
        price: res.price,
        summary: applied,
        createdAt: new Date(),
      });
      if (!res.ok) this.logger.warn(`Detran ${kind} ${vehicle.licensePlate}: ${res.code} ${res.message}`);
      summary.results.push({ kind, ok: res.ok, message: res.message, summary: applied });
    }
    return summary;
  }

  /** Evita pagar por consultas que não trariam nada novo. */
  private async shouldSkip(kind: DetranService, tenantId: string, vehicleId: any, year: number): Promise<string | null> {
    const filter = { tenantId: new Types.ObjectId(tenantId), vehicleId: new Types.ObjectId(String(vehicleId)), year };
    if (kind === 'licensing') {
      // Com o licenciamento do ano já registrado, a consulta não traria nada novo (só criamos registros).
      const lic = await this.licensingModel.findOne(filter).select('status').lean<any>();
      if (lic) return `Licenciamento ${year} já registrado${lic.status === 'PAID' ? ' e pago' : ''}.`;
    }
    if (kind === 'ipva') {
      const ipva = await this.ipvaModel.findOne(filter as any).select('_id').lean();
      if (ipva) return `IPVA ${year} já registrado.`;
    }
    return null;
  }

  private async applyFines(tenantId: string, vehicle: any, fines: DetranFine[]) {
    let created = 0;
    let markedPaid = 0;
    let createdValue = 0;
    for (const f of fines) {
      const existing = await this.fineModel.findOne({ tenantId: new Types.ObjectId(tenantId), noticeNumber: f.noticeNumber }).exec();
      if (existing) {
        if (f.paid && existing.status === FineStatus.PENDING) {
          await this.finesService.markAsPaid(String(existing._id));
          markedPaid++;
        }
        continue;
      }
      if (f.paid) continue; // multa antiga já paga: não entra no financeiro agora
      await this.finesService.create({
        vehicleId: String(vehicle._id),
        noticeNumber: f.noticeNumber,
        infractionDate: f.infractionDate.toISOString(),
        description: f.description,
        infractionCode: f.infractionCode,
        location: f.location,
        issuingAgency: f.issuingAgency,
        value: f.value,
        dueDate: isoDay(f.dueDate),
        status: FineStatus.PENDING,
        notes: `Encontrada na consulta automática ao Detran-${vehicle.uf}.`,
        source: `DETRAN_${vehicle.uf}`,
      } as any);
      created++;
      createdValue += f.value;
    }
    if (created) {
      await this.notificationsService.notifyTenantAdmins(tenantId, {
        title: `Multa nova no Detran-${vehicle.uf}`,
        message: `${vehicle.licensePlate}: ${created} multa(s) nova(s), total ${money(createdValue)}.`,
        type: NotificationType.FINE_DETECTED,
        link: '/multas',
        metadata: { vehicleId: String(vehicle._id) },
      });
    }
    return { found: fines.length, created, markedPaid };
  }

  private async applyLicensing(tenantId: string, vehicle: any, debts: DetranLicensingDebt[]) {
    let created = 0;
    for (const d of debts) {
      const exists = await this.licensingModel.findOne({ tenantId: new Types.ObjectId(tenantId), vehicleId: vehicle._id, year: d.year }).lean();
      if (exists) continue;
      await this.licensingService.create(tenantId, {
        vehicleId: String(vehicle._id),
        year: d.year,
        value: d.value,
        dueDate: isoDay(d.dueDate) ?? `${d.year}-12-31`,
      } as any);
      created++;
    }
    return { found: debts.length, created };
  }

  private async applyIpva(tenantId: string, vehicle: any, ipva: DetranIpva | null) {
    if (!ipva) return { found: 0, created: 0 };
    const exists = await this.ipvaModel.findOne({ tenantId: new Types.ObjectId(tenantId), vehicleId: vehicle._id, year: ipva.year } as any).lean();
    if (exists) return { found: 1, created: 0 };
    const totalAmount = Math.round(ipva.quotas.reduce((s, q) => s + q.amount, 0) * 100) / 100;
    const doc = await new this.ipvaModel({
      tenantId: new Types.ObjectId(tenantId),
      vehicleId: vehicle._id,
      year: ipva.year,
      totalAmount,
      discount: ipva.singleQuotaAmount ? Math.max(0, Math.round((totalAmount - ipva.singleQuotaAmount) * 100) / 100) : 0,
      status: IpvaStatus.PENDING,
      installments: ipva.quotas.map((q) => ({ installmentNumber: q.number, amount: q.amount, dueDate: q.dueDate, status: IpvaStatus.PENDING })),
    }).save();
    for (const inst of doc.installments) {
      const entry: any = await this.financialEntriesService.create({
        vehicleId: String(vehicle._id),
        type: FinancialEntryType.EXPENSE,
        category: FinancialEntryCategory.IPVA,
        amount: inst.amount,
        date: inst.dueDate,
        description: `IPVA ${ipva.year} - Parcela ${inst.installmentNumber}`,
        status: FinancialEntryStatus.PENDING,
        sourceId: doc._id.toString(),
      } as any);
      inst.financialEntryId = String(entry._id);
    }
    await doc.save();
    return { found: 1, created: 1, quotas: ipva.quotas.length, total: totalAmount };
  }
}
