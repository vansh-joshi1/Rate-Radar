import Stripe from 'stripe';
import type { Account, Interval, Plan } from './accounts';

/** The only file that knows the payment provider. */

let client: Stripe | null = null;

/** Null when STRIPE_SECRET_KEY is unset (local demo): billing routes answer 503. */
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}

/** The four Stripe prices, one env var each. Prices themselves live in Stripe (set by the owner, PRODUCT.md). */
export function priceId(plan: Plan, interval: Interval): string | undefined {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval === 'month' ? 'MONTHLY' : 'YEARLY'}`];
}

const PAIRS = (['starter', 'growth'] as const).flatMap((plan) => (['month', 'year'] as const).map((interval) => ({ plan, interval })));

export const planForPrice = (id: string) => PAIRS.find((p) => priceId(p.plan, p.interval) === id) ?? null;

const iso = (unix: number | null | undefined): string | undefined =>
  unix ? new Date(unix * 1000).toISOString() : undefined;

/**
 * A subscription's billing fields, ready to overwrite onto its account. Throws
 * on a price we don't sell, so the webhook fails loudly and Stripe retries it.
 */
export function accountFromSubscription(sub: Stripe.Subscription): Partial<Account> {
  const item = sub.items.data[0];
  const known = item && planForPrice(item.price.id);
  if (!known) throw new Error(`subscription ${sub.id} has unknown price ${item?.price.id}`);
  const periodEnd = iso(item.current_period_end);
  return {
    subscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    plan: known.plan,
    interval: known.interval,
    status: sub.status,
    currentPeriodEnd: periodEnd,
    // The portal schedules cancellation with either field depending on API version.
    cancelsAt: iso(sub.cancel_at) ?? (sub.cancel_at_period_end ? periodEnd : undefined),
  };
}
