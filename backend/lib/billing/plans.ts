/**
 * Plan prices as shown to people: the owner's (PRODUCT.md, commercial model).
 * What Stripe actually charges is the four STRIPE_PRICE_* prices, which must
 * match these. Shared by the landing page, the plan wall and Settings → Billing.
 */
export const PLAN_PRICES = {
  starter: { name: 'Starter', month: '$99', year: '$990' },
  growth: { name: 'Growth', month: '$249', year: '$2,490' },
} as const;
