import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Tenant, TenantDocument, PlanType } from '../tenants/schemas/tenant.schema';

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private configService: ConfigService,
  ) {}

  /** Lazy — so the app can boot and run without Stripe configured; billing routes just fail clearly until it is. */
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

  private priceIdForPlan(plan: PlanType): string {
    const envKey = `STRIPE_PRICE_${plan}`;
    const priceId = this.configService.get<string>(envKey);
    if (!priceId) {
      throw new InternalServerErrorException(`Preço do Stripe não configurado para o plano ${plan} (${envKey}).`);
    }
    return priceId;
  }

  private planForPriceId(priceId: string): PlanType | undefined {
    return (Object.values(PlanType) as PlanType[]).find(
      (plan) => this.configService.get<string>(`STRIPE_PRICE_${plan}`) === priceId,
    );
  }

  async createCheckoutSession(
    tenantId: string,
    plan: PlanType,
    interval: 'monthly' | 'annual' = 'monthly',
  ): Promise<{ url: string }> {
    const stripe = this.getStripeClient();
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.contactEmail || undefined,
        name: tenant.name,
        metadata: { tenantId },
      });
      customerId = customer.id;
      tenant.stripeCustomerId = customerId;
      await tenant.save();
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Para pagamento anual, usa billing cycles de 12 meses
    const billingCycleMonths = interval === 'annual' ? 12 : 1;

    // Cria ou obtém um cupom de 10% para anuais
    let discountData: { coupon?: string } | undefined;
    if (interval === 'annual') {
      try {
        // Procura por um coupon de 10% existing
        const coupons = await stripe.coupons.list({ limit: 100 });
        let discount10Coupon = coupons.data.find(
          (c) => c.percent_off === 10 && c.duration === 'repeating' && c.duration_in_months === 12,
        );

        // Se não encontra, cria um novo
        if (!discount10Coupon) {
          discount10Coupon = await stripe.coupons.create({
            percent_off: 10,
            duration: 'repeating',
            duration_in_months: 12,
            id: `annual_discount_10_${Date.now()}`,
          });
        }

        discountData = { coupon: discount10Coupon.id };
      } catch (err) {
        console.warn('Erro ao criar/buscar coupon de desconto:', err);
        // Continua sem desconto se falhar
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: this.priceIdForPlan(plan), quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { tenantId, plan, interval },
        billing_cycle_anchor: interval === 'annual' ? Math.floor(Date.now() / 1000) : undefined,
      },
      discounts: discountData ? [discountData] : undefined,
      success_url: `${frontendUrl}/planos?billing=success&plan=${plan}`,
      cancel_url: `${frontendUrl}/planos?billing=cancelled`,
      metadata: { tenantId, plan, interval },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe não retornou uma URL de checkout.');
    }
    return { url: session.url };
  }

  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    const stripe = this.getStripeClient();
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant?.stripeCustomerId) {
      throw new BadRequestException('Esta locadora ainda não possui uma assinatura.');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${frontendUrl}/configuracoes`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const stripe = this.getStripeClient();
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('Stripe webhook secret não configurado.');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Assinatura do webhook inválida: ${(err as Error).message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        if (tenantId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await this.syncTenantFromSubscription(tenantId, subscription);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await this.syncTenantFromSubscription(tenantId, subscription);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await this.tenantModel.findByIdAndUpdate(tenantId, {
            plan: PlanType.BASIC,
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: undefined,
          });
        }
        break;
      }
      default:
        break;
    }

    return { received: true };
  }

  private async syncTenantFromSubscription(tenantId: string, subscription: Stripe.Subscription): Promise<void> {
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = priceId ? this.planForPriceId(priceId) : undefined;
    const interval = (subscription.metadata?.interval as 'monthly' | 'annual') || 'monthly';
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    await this.tenantModel.findByIdAndUpdate(tenantId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionBillingInterval: interval,
      nextBillingDate: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined,
      ...(plan ? { plan } : {}),
    });
  }
}
