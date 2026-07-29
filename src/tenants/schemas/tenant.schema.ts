import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

export enum PlanType {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

@Schema({
  timestamps: true,
  collection: 'tenants',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Tenant {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  cnpj: string;

  @Prop({ trim: true })
  contactEmail: string;

  @Prop({ trim: true })
  contactPhone: string;

  @Prop({ type: String, enum: PlanType, default: PlanType.BASIC })
  plan: PlanType;

  @Prop({ default: true })
  isActive: boolean;

  // Branding — white-label identity for this tenant.
  // Not `required` at the schema level: existing tenants predate this field, and a
  // required+unique index would fail to build against docs that all lack it. New
  // tenants always get one assigned in TenantsService; sparse keeps the unique
  // index from colliding on the old, still-missing values.
  @Prop({ unique: true, sparse: true, trim: true, lowercase: true })
  subdomain: string;

  @Prop({ trim: true })
  logoUrl: string;

  @Prop({ trim: true, default: '#1e6e6b' })
  primaryColor: string;

  @Prop({ trim: true, lowercase: true })
  customDomain: string;

  // Billing — set once a checkout session completes; absent for tenants that
  // never started a subscription (e.g. still on the default BASIC plan).
  @Prop({ trim: true })
  stripeCustomerId: string;

  @Prop({ trim: true })
  stripeSubscriptionId: string;

  // Mirrors Stripe's subscription status verbatim (trialing, active, past_due,
  // canceled, ...) rather than modeling our own state machine on top of it.
  @Prop({ trim: true })
  subscriptionStatus: string;

  @Prop({ trim: true, enum: ['monthly', 'annual', 'annual_installments'], default: 'monthly' })
  subscriptionBillingInterval: 'monthly' | 'annual' | 'annual_installments';

  // Rastreia parcelas pagas do plano anual parcelado
  @Prop({ type: Number, default: 0 })
  installmentsPaid: number;

  // Data de próxima cobrança para parcelamento
  @Prop({ type: Date })
  nextInstallmentDate: Date;

  // Período de teste gratuito (7 dias)
  @Prop({ default: true })
  isTrialActive: boolean;

  @Prop({ type: Date })
  trialStartDate: Date;

  @Prop({ type: Date })
  trialEndDate: Date;

  // Payment method para cobrança automática ao final do teste
  @Prop({ trim: true })
  stripePaymentMethodId: string;

  // Data quando o pagamento automático foi realizado
  @Prop({ type: Date })
  autoChargeDate: Date;

  // Data do próximo ciclo de cobrança da assinatura (mirror de subscription.items[0].current_period_end)
  @Prop({ type: Date })
  nextBillingDate: Date;

  // Rastreia aceitação de termos de cancelamento
  @Prop({ default: false })
  acceptedCancellationTerms: boolean;

  @Prop({ type: Date })
  cancellationTermsAcceptedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
