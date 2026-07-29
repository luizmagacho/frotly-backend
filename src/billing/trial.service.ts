import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Tenant, TenantDocument, PlanType } from '../tenants/schemas/tenant.schema';

// Nomes amigáveis e preço mensal de referência de cada plano — usados para exibir o
// status do plano/trial na plataforma sem precisar consultar o Stripe a cada request.
const PLAN_INFO: Record<PlanType, { name: string; monthlyPrice: number }> = {
  [PlanType.BASIC]: { name: 'Plano Básico', monthlyPrice: 99 },
  [PlanType.PRO]: { name: 'Plano Profissional', monthlyPrice: 249 },
  [PlanType.ENTERPRISE]: { name: 'Plano Enterprise', monthlyPrice: 599 },
};

@Injectable()
export class TrialService {
  private stripe: Stripe | null = null;

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private configService: ConfigService,
  ) {}

  private getStripeClient(): Stripe {
    if (!this.stripe) {
      const key = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (!key) {
        throw new InternalServerErrorException('Stripe não está configurado (STRIPE_SECRET_KEY ausente).');
      }
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  /** Registra o Payment Method para cobrança futura do trial */
  async setPaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    // Valida se o payment method existe no Stripe
    const stripe = this.getStripeClient();
    try {
      await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (err) {
      throw new BadRequestException('Payment method inválido ou expirado.');
    }

    // Se não tem Stripe customer, cria um (payment_method é anexado automaticamente na criação)
    if (!tenant.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.contactEmail || undefined,
        name: tenant.name,
        metadata: { tenantId },
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      tenant.stripeCustomerId = customer.id;
    } else {
      // Cliente existente: o payment method precisa ser anexado explicitamente antes de virar padrão
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: tenant.stripeCustomerId,
      });
      await stripe.customers.update(tenant.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Salva o payment method ID
    tenant.stripePaymentMethodId = paymentMethodId;
    await tenant.save();
  }

  /** Cria trial de 7 dias para novo tenant, já no plano e periodicidade de interesse escolhidos no cadastro */
  async initiateTrial(
    tenantId: string,
    plan?: PlanType,
    billingInterval?: 'monthly' | 'annual',
  ): Promise<{ trialEndsAt: Date }> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias

    tenant.isTrialActive = true;
    tenant.trialStartDate = now;
    tenant.trialEndDate = trialEndDate;
    tenant.plan = plan ?? PlanType.BASIC; // Plano que será cobrado ao fim do trial
    tenant.subscriptionBillingInterval = billingInterval ?? 'monthly';
    await tenant.save();

    return { trialEndsAt: trialEndDate };
  }

  /** Verifica e cobra tenants cujo trial expirou */
  @Cron(CronExpression.EVERY_HOUR)
  async chargeExpiredTrials(): Promise<void> {
    const now = new Date();

    // Encontra tenants com trial expirado que ainda não foram cobrados
    const expiredTrials = await this.tenantModel.find({
      isTrialActive: true,
      trialEndDate: { $lte: now },
      autoChargeDate: { $exists: false },
      stripePaymentMethodId: { $exists: true, $ne: null },
      stripeCustomerId: { $exists: true, $ne: null },
    });

    const stripe = this.getStripeClient();

    for (const tenant of expiredTrials) {
      try {
        // Obter o preço do plano
        const priceId = this.getPriceIdForPlan(tenant.plan);

        // Anual: mesmo preço mensal recorrente, mas com 10% de desconto aplicado nos
        // primeiros 12 ciclos — mesma mecânica usada no checkout de /planos.
        const discounts =
          tenant.subscriptionBillingInterval === 'annual'
            ? [{ coupon: await this.getOrCreateAnnualCoupon(stripe) }]
            : undefined;

        // O preço do plano é recorrente (mensal/anual), então a cobrança pós-trial precisa
        // ser uma Subscription — invoiceItems avulsos só aceitam preços "one_time". A
        // subscription cobra imediatamente a primeira fatura e segue cobrando sozinha
        // nos ciclos seguintes, sem depender mais deste cron para o mesmo tenant.
        const subscription = await stripe.subscriptions.create({
          customer: tenant.stripeCustomerId,
          items: [{ price: priceId }],
          default_payment_method: tenant.stripePaymentMethodId,
          metadata: { tenantId: tenant._id.toString() },
          discounts,
        });

        // Marcar como cobrado
        const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
        tenant.isTrialActive = false;
        tenant.autoChargeDate = now;
        tenant.stripeSubscriptionId = subscription.id;
        tenant.subscriptionStatus = subscription.status;
        tenant.nextBillingDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined;
        await tenant.save();

        console.log(`✅ Trial cobrado para tenant ${tenant._id}`);
      } catch (err) {
        console.error(`❌ Erro ao cobrar trial para tenant ${tenant._id}:`, err.message);
        // Continua com o próximo tenant em vez de falhar
      }
    }
  }

  /** Status completo do plano/trial/assinatura — usado para exibir na plataforma qual plano o
   * usuário escolheu, quantos dias faltam de teste ou quando será a próxima cobrança. */
  async getTrialStatus(tenantId: string): Promise<{
    isTrialActive: boolean;
    daysRemaining: number;
    trialEndsAt: Date;
    needsPaymentMethod: boolean;
    plan: PlanType;
    planName: string;
    monthlyPrice: number;
    billingInterval: 'monthly' | 'annual' | 'annual_installments';
    effectiveMonthlyPrice: number;
    subscriptionStatus: string;
    nextBillingDate: Date;
  }> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    const now = new Date();
    const daysRemaining = tenant.trialEndDate
      ? Math.ceil((tenant.trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    const planInfo = PLAN_INFO[tenant.plan] ?? PLAN_INFO[PlanType.BASIC];
    const isAnnual = tenant.subscriptionBillingInterval?.startsWith('annual');
    const effectiveMonthlyPrice = isAnnual ? Math.round(planInfo.monthlyPrice * 0.9 * 100) / 100 : planInfo.monthlyPrice;

    return {
      isTrialActive: tenant.isTrialActive && daysRemaining > 0,
      daysRemaining: Math.max(0, daysRemaining),
      trialEndsAt: tenant.trialEndDate,
      needsPaymentMethod: !tenant.stripePaymentMethodId,
      plan: tenant.plan,
      planName: planInfo.name,
      monthlyPrice: planInfo.monthlyPrice,
      billingInterval: tenant.subscriptionBillingInterval ?? 'monthly',
      effectiveMonthlyPrice,
      subscriptionStatus: tenant.subscriptionStatus,
      nextBillingDate: tenant.nextBillingDate,
    };
  }

  /** Cancela o trial (usuário escolhe não continuar) */
  async cancelTrial(tenantId: string): Promise<void> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    tenant.isTrialActive = false;
    await tenant.save();
  }

  private getPriceIdForPlan(plan: PlanType): string {
    const envKey = `STRIPE_PRICE_${plan}`;
    const priceId = this.configService.get<string>(envKey);
    if (!priceId) {
      throw new InternalServerErrorException(`Preço do Stripe não configurado para o plano ${plan} (${envKey}).`);
    }
    return priceId;
  }

  /** Reaproveita (ou cria) o cupom de 10% repetido por 12 meses usado na cobrança anual. */
  private async getOrCreateAnnualCoupon(stripe: Stripe): Promise<string> {
    const coupons = await stripe.coupons.list({ limit: 100 });
    const existing = coupons.data.find(
      (c) => c.percent_off === 10 && c.duration === 'repeating' && c.duration_in_months === 12,
    );
    if (existing) {
      return existing.id;
    }
    const created = await stripe.coupons.create({
      percent_off: 10,
      duration: 'repeating',
      duration_in_months: 12,
      id: `annual_discount_10_${Date.now()}`,
    });
    return created.id;
  }
}
