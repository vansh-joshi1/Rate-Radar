import { cache } from 'react';
import { getStore, storeFor, type Store } from '../store';
import { accountFor, isExempt, type Account, type Plan } from './accounts';
import { PLAN_LIMITS } from './plans';
import { trimWatchlist } from '../watchlist';
import { ownersOf } from '../auth/members';
import { loadProperty } from '../properties';
import { sendEmail } from '../email/send';
import { compsTrimmedEmail } from '../email/messages';

/**
 * What a hotel's plan lets it use. Locked or open is access()'s call, not this.
 * Design: docs/design/specs/2026-09-30-plan-limits-design.md
 */

/** Hard ceiling on any watchlist, whatever the plan: the cap before plans existed. */
export const MAX_COMPS = 25;

export type Limits = { plan: Plan; bellhop: boolean; maxComps: number; historyDays: number };

/** The original property and the demo: Growth, with only the hard ceiling on competitors. */
export const EXEMPT_LIMITS: Limits = { plan: 'growth', ...PLAN_LIMITS.growth, maxComps: MAX_COMPS };

/** A trial runs on Growth. */
export function limitsFor(account: Account, propertyId: string): Limits {
  if (isExempt(propertyId)) return EXEMPT_LIMITS;
  const plan = account.plan ?? 'growth';
  return { plan, ...PLAN_LIMITS[plan] };
}

/** The hotel's account, read once per page render (the layout and the page both need it). */
export const requestAccount = cache((propertyId: string) => accountFor(getStore(), propertyId));

export async function limitsForProperty(propertyId: string): Promise<Limits> {
  return limitsFor(await requestAccount(propertyId), propertyId);
}

/**
 * Hold one hotel's watchlist to its plan's competitor cap and tell its owners
 * what went. Runs after a plan change (the billing webhook) and on every
 * ingest, before the list bounds that run's compset, which also catches lists
 * that predate the caps or that a concurrent write put back. A repeat finds
 * nothing over the cap and sends nothing. A failed email is only logged: the
 * Competitors page shows the same note.
 */
export async function enforceCompCap(account: Account, propertyId: string, store: Store = storeFor(propertyId)): Promise<void> {
  if (isExempt(propertyId)) return;
  const max = limitsFor(account, propertyId).maxComps;
  const removed = await trimWatchlist(store, propertyId, max);
  if (removed.length === 0 || !process.env.RESEND_API_KEY) return;
  const owners = await ownersOf(getStore(), propertyId);
  if (owners.length === 0) return;
  const hotelName = (await loadProperty(getStore(), propertyId))?.name ?? 'Your hotel';
  await sendEmail({
    to: owners,
    ...compsTrimmedEmail({ hotelName, removed, max, dashboardUrl: process.env.DASHBOARD_URL }),
  }).catch((err) => console.error(`[billing] trim email for ${propertyId} failed:`, err));
}
