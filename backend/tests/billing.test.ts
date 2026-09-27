import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Stripe from 'stripe';
import { FileStore } from '../lib/store';
import { saveMembers } from '../lib/auth/members';
import { DEFAULT_PROPERTY_ID, DEMO_PROPERTY } from '../lib/properties';
import { access, accountFor, billingView, newAccount, type Account } from '../lib/billing/accounts';
import { accountFromSubscription } from '../lib/billing/stripe';

const NOW = new Date('2026-10-01T12:00:00Z');
const trial = (daysFromNow: number): Account => ({
  ...newAccount('hotel-a', 'gm@a.com', NOW),
  trialEndsAt: new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString(),
});

describe('access', () => {
  it('never locks the original hotel or the demo', () => {
    expect(access(null, DEFAULT_PROPERTY_ID, NOW)).toBe('open');
    expect(access(null, DEMO_PROPERTY.id, NOW)).toBe('open');
  });

  it('opens during the trial and locks after it', () => {
    expect(access(trial(1), 'hotel-a', NOW)).toBe('open');
    expect(access(trial(-1), 'hotel-a', NOW)).toBe('locked');
    expect(access(trial(0), 'hotel-a', NOW)).toBe('locked');
  });

  it('follows the subscription once there is one, whatever the trial says', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(access({ ...trial(-30), status }, 'hotel-a', NOW)).toBe('open');
    }
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']) {
      expect(access({ ...trial(5), status }, 'hotel-a', NOW)).toBe('locked');
    }
  });
});

describe('accountFor', () => {
  it('creates a 14-day trial for the hotel owner once, then returns the same account', async () => {
    const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-bill-')), 'store.json'));
    await saveMembers(store, [
      { email: 'desk@a.com', role: 'viewer', invitedAt: '', propertyId: 'hotel-a' },
      { email: 'gm@a.com', role: 'owner', invitedAt: '', propertyId: 'hotel-a' },
    ]);
    const first = await accountFor(store, 'hotel-a', NOW);
    expect(first.ownerEmail).toBe('gm@a.com');
    expect(first.trialEndsAt).toBe('2026-10-15T12:00:00.000Z');
    const later = await accountFor(store, 'hotel-a', new Date('2026-12-01T00:00:00Z'));
    expect(later.trialEndsAt).toBe(first.trialEndsAt);
  });
});

describe('accountFromSubscription', () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_sm';
    process.env.STRIPE_PRICE_GROWTH_YEARLY = 'price_gy';
  });

  const sub = (price: string, extra: Partial<Stripe.Subscription> = {}) =>
    ({
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      cancel_at: null,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: price }, current_period_end: 1_793_491_200 }] },
      ...extra,
    }) as unknown as Stripe.Subscription;

  it('maps price, status and period end', () => {
    expect(accountFromSubscription(sub('price_gy'))).toEqual({
      subscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      plan: 'growth',
      interval: 'year',
      status: 'active',
      currentPeriodEnd: '2026-11-01T00:00:00.000Z',
      cancelsAt: undefined,
    });
  });

  it('records a scheduled cancellation from either Stripe field', () => {
    expect(accountFromSubscription(sub('price_sm', { cancel_at_period_end: true })).cancelsAt).toBe('2026-11-01T00:00:00.000Z');
    expect(accountFromSubscription(sub('price_sm', { cancel_at: 1_793_491_200 })).cancelsAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('throws on a price we do not sell, so the webhook fails and Stripe retries', () => {
    expect(() => accountFromSubscription(sub('price_other'))).toThrow(/unknown price/);
  });
});

describe('billingView', () => {
  it('counts trial days and offers the plans', () => {
    expect(billingView(trial(9), NOW)).toMatchObject({ status: '9 days left, ends Oct 10, 2026', canSubscribe: true, canManage: false });
    expect(billingView(trial(-1), NOW).status).toBe('Trial ended');
  });

  it('describes a live subscription and hides the plans', () => {
    const paid: Account = { ...trial(-1), stripeCustomerId: 'cus_1', plan: 'starter', interval: 'month', status: 'active', currentPeriodEnd: '2026-11-01T00:00:00Z' };
    expect(billingView(paid, NOW)).toEqual({ plan: 'Starter, $99 per month', status: 'Active, renews Nov 1, 2026', canSubscribe: false, canManage: true });
    expect(billingView({ ...paid, cancelsAt: '2026-11-01T00:00:00Z' }, NOW).status).toBe('Cancels Nov 1, 2026');
    expect(billingView({ ...paid, status: 'past_due' }, NOW).status).toBe('Payment failed, Stripe is retrying the card');
    expect(billingView({ ...paid, status: 'canceled' }, NOW)).toMatchObject({ status: 'Ended', canSubscribe: true });
  });
});

describe('billing webhook', () => {
  it('rejects a delivery without a valid Stripe signature', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    const { POST } = await import('../../frontend/app/api/billing/webhook/route');
    const res = await POST(new Request('http://x/api/billing/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=bad' } }));
    expect(res.status).toBe(400);
  });
});
