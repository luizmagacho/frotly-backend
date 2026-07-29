import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Tenant, PlanType } from '../tenants/schemas/tenant.schema';

// Variables prefixed with "mock" are exempt from Jest's out-of-scope-variable
// restriction on jest.mock() factories (jest.mock calls are hoisted above imports).
const mockStripeInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptions: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockStripeInstance),
}));

describe('BillingService', () => {
  let service: BillingService;
  let stripeMock: typeof mockStripeInstance;
  let tenantModel: any;
  let configValues: Record<string, string | undefined>;

  const buildTenantDoc = (overrides: Partial<any> = {}) => ({
    _id: 'tenant-1',
    name: 'Locadora Teste',
    contactEmail: 'contato@teste.com',
    stripeCustomerId: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(async () => {
    stripeMock = mockStripeInstance;
    stripeMock.customers.create.mockReset();
    stripeMock.checkout.sessions.create.mockReset();
    stripeMock.billingPortal.sessions.create.mockReset();
    stripeMock.subscriptions.retrieve.mockReset();
    stripeMock.webhooks.constructEvent.mockReset();

    configValues = {
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: 'whsec_fake',
      STRIPE_PRICE_BASIC: 'price_basic',
      STRIPE_PRICE_PRO: 'price_pro',
      STRIPE_PRICE_ENTERPRISE: 'price_enterprise',
      FRONTEND_URL: 'http://localhost:3000',
    };

    tenantModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getModelToken(Tenant.name), useValue: tenantModel },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback) },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('creates a Stripe customer when the tenant has none yet, and persists it', async () => {
      const tenant = buildTenantDoc();
      tenantModel.findById.mockResolvedValue(tenant);
      stripeMock.customers.create.mockResolvedValue({ id: 'cus_new' });
      stripeMock.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session_abc' });

      const result = await service.createCheckoutSession('tenant-1', PlanType.PRO);

      expect(stripeMock.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'contato@teste.com', name: 'Locadora Teste', metadata: { tenantId: 'tenant-1' } }),
      );
      expect(tenant.stripeCustomerId).toBe('cus_new');
      expect(tenant.save).toHaveBeenCalled();
      expect(result).toEqual({ url: 'https://checkout.stripe.com/session_abc' });
    });

    it('reuses an existing Stripe customer instead of creating a new one', async () => {
      const tenant = buildTenantDoc({ stripeCustomerId: 'cus_existing' });
      tenantModel.findById.mockResolvedValue(tenant);
      stripeMock.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session_xyz' });

      await service.createCheckoutSession('tenant-1', PlanType.BASIC);

      expect(stripeMock.customers.create).not.toHaveBeenCalled();
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
      );
    });

    it('maps the requested plan to the configured Stripe price id', async () => {
      const tenant = buildTenantDoc({ stripeCustomerId: 'cus_existing' });
      tenantModel.findById.mockResolvedValue(tenant);
      stripeMock.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

      await service.createCheckoutSession('tenant-1', PlanType.ENTERPRISE);

      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_enterprise', quantity: 1 }],
          subscription_data: expect.objectContaining({ trial_period_days: 7 }),
        }),
      );
    });

    it('throws NotFoundException for an unknown tenant', async () => {
      tenantModel.findById.mockResolvedValue(null);
      await expect(service.createCheckoutSession('missing', PlanType.PRO)).rejects.toThrow(NotFoundException);
    });

    it('throws a clear config error when STRIPE_SECRET_KEY is unset', async () => {
      configValues.STRIPE_SECRET_KEY = undefined;
      await expect(service.createCheckoutSession('tenant-1', PlanType.PRO)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws a clear config error when the plan has no configured price id', async () => {
      const tenant = buildTenantDoc({ stripeCustomerId: 'cus_existing' });
      tenantModel.findById.mockResolvedValue(tenant);
      configValues.STRIPE_PRICE_PRO = undefined;

      await expect(service.createCheckoutSession('tenant-1', PlanType.PRO)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createPortalSession', () => {
    it('creates a portal session for a tenant with a Stripe customer', async () => {
      tenantModel.findById.mockResolvedValue(buildTenantDoc({ stripeCustomerId: 'cus_existing' }));
      stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });

      const result = await service.createPortalSession('tenant-1');

      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
      );
      expect(result).toEqual({ url: 'https://billing.stripe.com/portal' });
    });

    it('rejects a tenant that never started a subscription', async () => {
      tenantModel.findById.mockResolvedValue(buildTenantDoc({ stripeCustomerId: undefined }));
      await expect(service.createPortalSession('tenant-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('rejects an invalid signature without touching the database', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('signature mismatch');
      });

      await expect(service.handleWebhook(Buffer.from('{}'), 'bad-sig')).rejects.toThrow(BadRequestException);
      expect(tenantModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('syncs plan + subscription state on checkout.session.completed', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { metadata: { tenantId: 'tenant-1' }, subscription: 'sub_123' } },
      });
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        status: 'trialing',
        items: { data: [{ price: { id: 'price_pro' } }] },
      });

      await service.handleWebhook(Buffer.from('{}'), 'good-sig');

      expect(tenantModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ stripeSubscriptionId: 'sub_123', subscriptionStatus: 'trialing', plan: PlanType.PRO }),
      );
    });

    it('syncs status on customer.subscription.updated', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'past_due',
            metadata: { tenantId: 'tenant-1' },
            items: { data: [{ price: { id: 'price_basic' } }] },
          },
        },
      });

      await service.handleWebhook(Buffer.from('{}'), 'good-sig');

      expect(tenantModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ subscriptionStatus: 'past_due', plan: PlanType.BASIC }),
      );
    });

    it('downgrades to BASIC and clears the subscription id on customer.subscription.deleted', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { metadata: { tenantId: 'tenant-1' } } },
      });

      await service.handleWebhook(Buffer.from('{}'), 'good-sig');

      expect(tenantModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ plan: PlanType.BASIC, subscriptionStatus: 'canceled' }),
      );
    });

    it('ignores event types it does not handle', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: {} } });
      const result = await service.handleWebhook(Buffer.from('{}'), 'good-sig');
      expect(result).toEqual({ received: true });
      expect(tenantModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
