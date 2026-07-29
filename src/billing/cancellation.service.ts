import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Tenant, TenantDocument, PlanType } from '../tenants/schemas/tenant.schema';

@Injectable()
export class CancellationService {
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

  private getPriceForPlan(plan: PlanType): number {
    const prices: Record<PlanType, number> = {
      [PlanType.BASIC]: 99.00,
      [PlanType.PRO]: 249.00,
      [PlanType.ENTERPRISE]: 599.00,
    };
    return prices[plan];
  }

  /** Calcula a multa de cancelamento para planos anuais parcelados */
  calculateCancellationPenalty(
    plan: PlanType,
    interval: 'monthly' | 'annual' | 'annual_installments',
    installmentsPaid: number,
  ): { penalty: number; breakdown: string } {
    // Apenas planos anuais parcelados têm multa
    if (interval !== 'annual_installments') {
      return { penalty: 0, breakdown: 'Sem multa para este tipo de plano' };
    }

    const monthlyPrice = this.getPriceForPlan(plan);
    const annualPrice = monthlyPrice * 12 * 0.9; // Com 10% de desconto
    const installmentAmount = annualPrice / 12;

    // Parcelas restantes = 12 - pagas
    const remainingInstallments = 12 - installmentsPaid;

    // Valor restante a pagar
    const remainingAmount = remainingInstallments * installmentAmount;

    // Multa de 20% do valor restante
    const penalty = remainingAmount * 0.2;

    const breakdown = `Multa de 20% sobre R$ ${remainingAmount.toFixed(2)} (${remainingInstallments} parcelas restantes) = R$ ${penalty.toFixed(2)}`;

    return { penalty, breakdown };
  }

  /** Cancela a assinatura e cobra multa se aplicável */
  async cancelSubscription(
    tenantId: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    message: string;
    penalty?: number;
    breakdown?: string;
  }> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    if (!tenant.stripeSubscriptionId) {
      throw new BadRequestException('Esta locadora não possui uma assinatura ativa.');
    }

    const stripe = this.getStripeClient();

    try {
      // Calcular multa se aplicável
      const { penalty, breakdown } = this.calculateCancellationPenalty(
        tenant.plan,
        tenant.subscriptionBillingInterval as any,
        tenant.installmentsPaid || 0,
      );

      // Se houver multa, criar um invoice
      if (penalty > 0 && tenant.stripeCustomerId) {
        try {
          // Criar uma invoice para a multa de cancelamento
          const invoiceItem = await stripe.invoiceItems.create({
            customer: tenant.stripeCustomerId,
            amount: Math.round(penalty * 100), // Stripe usa centavos
            currency: 'brl',
            description: `Multa de cancelamento - ${breakdown}`,
          });

          // Criar e finalizar invoice
          const invoice = await stripe.invoices.create({
            customer: tenant.stripeCustomerId,
            collection_method: 'charge_automatically',
            auto_advance: true,
          });

          await stripe.invoices.finalizeInvoice(invoice.id);

          console.log(`✅ Multa de cancelamento cobrada: R$ ${penalty.toFixed(2)}`);
        } catch (err) {
          console.error('Erro ao criar invoice de multa:', err.message);
          // Continua com o cancelamento mesmo se falhar ao cobrar a multa
        }
      }

      // Cancelar a assinatura
      await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);

      // Atualizar status no banco de dados
      tenant.subscriptionStatus = 'canceled';
      tenant.plan = PlanType.BASIC; // Volta ao plano básico
      tenant.acceptedCancellationTerms = true;
      tenant.cancellationTermsAcceptedAt = new Date();
      await tenant.save();

      return {
        success: true,
        message: `Assinatura cancelada com sucesso${penalty > 0 ? ' e multa de cancelamento cobrada' : ''}`,
        penalty,
        breakdown,
      };
    } catch (err) {
      throw new InternalServerErrorException(`Erro ao cancelar assinatura: ${(err as Error).message}`);
    }
  }

  /** Retorna informações sobre multa se cancelar agora */
  async getPenaltyInfo(tenantId: string): Promise<{
    hasPenalty: boolean;
    penalty: number;
    breakdown: string;
    remainingInstallments: number;
  }> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }

    const { penalty, breakdown } = this.calculateCancellationPenalty(
      tenant.plan,
      tenant.subscriptionBillingInterval as any,
      tenant.installmentsPaid || 0,
    );

    const monthlyPrice = this.getPriceForPlan(tenant.plan);
    const annualPrice = monthlyPrice * 12 * 0.9;
    const installmentAmount = annualPrice / 12;
    const remainingInstallments = 12 - (tenant.installmentsPaid || 0);

    return {
      hasPenalty: penalty > 0,
      penalty,
      breakdown,
      remainingInstallments,
    };
  }
}
