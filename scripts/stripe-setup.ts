// One-off setup: creates the 3 subscription products/prices for this SaaS in
// your Stripe account, tagged with metadata so they stay identifiable once
// other SaaS products share the same account. Prints the price IDs to paste
// into your .env as STRIPE_PRICE_BASIC / _PRO / _ENTERPRISE.
//
// Test mode (recommended first):
//   STRIPE_SECRET_KEY=sk_test_... npx ts-node scripts/stripe-setup.ts
//
// Live mode (only after test mode is verified end-to-end):
//   STRIPE_SECRET_KEY=sk_live_... CONFIRM_LIVE=yes npx ts-node scripts/stripe-setup.ts
//
// Prices below are placeholders — edit the amounts (in centavos) before
// running if you already know your real pricing, or just edit them later in
// the Stripe dashboard.
import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ Set STRIPE_SECRET_KEY before running this script.');
  process.exit(1);
}

const IS_LIVE = SECRET_KEY.startsWith('sk_live_');
if (IS_LIVE && process.env.CONFIRM_LIVE !== 'yes') {
  console.error(
    '❌ This is a LIVE secret key. Real products will be created in your production Stripe account.\n' +
      '   Re-run with CONFIRM_LIVE=yes if that is really what you want — but test mode first is strongly recommended.',
  );
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY);

const SAAS_KEY = 'gestorfrota';
const SAAS_LABEL = 'GestorFrota';

const PLANS = [
  { key: 'BASIC', name: `${SAAS_LABEL} — Basic`, amountCentavos: 9900 },
  { key: 'PRO', name: `${SAAS_LABEL} — Pro`, amountCentavos: 24900 },
  { key: 'ENTERPRISE', name: `${SAAS_LABEL} — Enterprise`, amountCentavos: 59900 },
];

async function main() {
  console.log(`Mode: ${IS_LIVE ? 'LIVE' : 'TEST'}`);
  console.log(`Creating products and monthly prices in BRL for "${SAAS_LABEL}"...\n`);

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: plan.name,
      description: `Plano ${plan.key} do ${SAAS_LABEL}`,
      metadata: { saas: SAAS_KEY, plan: plan.key },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'brl',
      unit_amount: plan.amountCentavos,
      recurring: { interval: 'month' },
      metadata: { saas: SAAS_KEY, plan: plan.key },
    });

    console.log(`${plan.key}: R$ ${(plan.amountCentavos / 100).toFixed(2)}/mês`);
    console.log(`  STRIPE_PRICE_${plan.key}=${price.id}\n`);
  }

  console.log('✅ Done. Copy the STRIPE_PRICE_* lines above into your .env.');
  console.log(`   Every product/price above is tagged metadata.saas="${SAAS_KEY}" — filter by that in the Stripe dashboard once other SaaS share this account.`);
}

main().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
