import type { Store } from '../store';
import { DEFAULT_PROPERTY_ID, DEMO_PROPERTY } from '../properties';
import { listMembers, memberProperty } from '../auth/members';
import { PLAN_PRICES } from './plans';

/**
 * Who pays, and whether they may use the product right now.
 *
 * A subscription belongs to an account, not a hotel, so a Growth customer's
 * later hotels attach here without reworking billing. Today every account holds
 * one hotel and its id is that hotel's id. Stored in the global store: the
 * webhook arrives with no session and has to find the account from Stripe ids.
 *
 * Design: docs/design/specs/2026-09-27-stripe-billing-design.md
 */

export type Plan = 'starter' | 'growth';
export type Interval = 'month' | 'year';

export interface Account {
  id: string;
  ownerEmail: string;
  propertyIds: string[];
  trialEndsAt: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  plan?: Plan;
  interval?: Interval;
  /** Stripe's subscription status, verbatim. Absent until the first checkout. */
  status?: string;
  currentPeriodEnd?: string;
  /** Set when the subscription is scheduled to end (cancelled in the portal). */
  cancelsAt?: string;
}

export const TRIAL_DAYS = 14;
const ACCOUNTS = 'accounts';
const BY_PROPERTY = 'account:byProperty';
const DAY = 86_400_000;

/** The original hotel and the demo are never billed or locked. */
export const isExempt = (propertyId: string): boolean =>
  propertyId === DEFAULT_PROPERTY_ID || propertyId === DEMO_PROPERTY.id;

/** Subscription statuses that keep the app open. Stripe retries the card while past_due, so access holds until it gives up. */
export const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function access(account: Account | null, propertyId: string, now: Date): 'open' | 'locked' {
  if (isExempt(propertyId)) return 'open';
  if (!account) return 'locked';
  if (account.status) return LIVE_STATUSES.has(account.status) ? 'open' : 'locked';
  return now < new Date(account.trialEndsAt) ? 'open' : 'locked';
}

export function trialDaysLeft(account: Account, now: Date): number {
  return Math.max(0, Math.ceil((new Date(account.trialEndsAt).getTime() - now.getTime()) / DAY));
}

export function newAccount(propertyId: string, ownerEmail: string, now: Date): Account {
  return {
    id: propertyId,
    ownerEmail,
    propertyIds: [propertyId],
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY).toISOString(),
  };
}

export async function saveAccount(store: Store, account: Account): Promise<void> {
  await store.hset(ACCOUNTS, account.id, account);
  for (const p of account.propertyIds) await store.hset(BY_PROPERTY, p, account.id);
}

export async function getAccount(store: Store, id: string): Promise<Account | null> {
  return store.hget<Account>(ACCOUNTS, id);
}

/**
 * The hotel's account. A hotel approved before billing shipped has none; it
 * gets one here, on first lookup, with a fresh trial from that moment.
 */
export async function accountFor(store: Store, propertyId: string, now = new Date()): Promise<Account> {
  const id = await store.hget<string>(BY_PROPERTY, propertyId);
  const found = id ? await getAccount(store, id) : null;
  if (found) return found;
  const owner = (await listMembers(store)).find((m) => memberProperty(m) === propertyId && m.role === 'owner');
  const account = newAccount(propertyId, owner?.email ?? '', now);
  await saveAccount(store, account);
  return account;
}

export interface BillingView {
  plan: string;
  status: string;
  /** Offer the plan picker (the view still checks the viewer is the owner). */
  canSubscribe: boolean;
  /** Offer Stripe's portal: there is a Stripe customer to open it for. */
  canManage: boolean;
}

const day = (iso: string | undefined, timeZone: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : '';

/** What Settings → Billing says about an account. Dates are in the hotel's timezone, as Stripe shows them. */
export function billingView(a: Account, now: Date, timeZone: string): BillingView {
  const canManage = Boolean(a.stripeCustomerId);
  if (!a.status || !a.plan || !a.interval) {
    const left = trialDaysLeft(a, now);
    return {
      plan: 'Trial, Growth features',
      status: left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} left, ends ${day(a.trialEndsAt, timeZone)}` : 'Trial ended',
      canSubscribe: true,
      canManage,
    };
  }
  const plan = `${PLAN_PRICES[a.plan].name}, ${PLAN_PRICES[a.plan][a.interval]} per ${a.interval}`;
  if (!LIVE_STATUSES.has(a.status)) return { plan, status: 'Ended', canSubscribe: true, canManage };
  const status =
    a.status === 'past_due'
      ? 'Payment failed, Stripe is retrying the card'
      : a.cancelsAt
        ? `Cancels ${day(a.cancelsAt, timeZone)}`
        : a.status === 'trialing'
          ? `Subscribed, first charge ${day(a.currentPeriodEnd, timeZone)}`
          : `Active, renews ${day(a.currentPeriodEnd, timeZone)}`;
  return { plan, status, canSubscribe: false, canManage };
}
