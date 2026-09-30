import { cache } from 'react';
import { getStore, storeFor, type Store } from '../store';
import { accountFor, isExempt, type Account, type Plan } from './accounts';
import { PLAN_LIMITS } from './plans';
import { trimWatchlist } from '../watchlist';
import { ownersOf } from '../auth/members';
import { loadProperty } from '../properties';
import { sendEmail } from '../email/send';
import { compsTrimmedEmail } from '../email/messages';

/** What a hotel's plan lets it use. Design: docs/design/specs/2026-09-30-plan-limits-design.md */

/** Hard ceiling on any watchlist, whatever the plan. */
export const MAX_COMPS = 25;

export type Limits = { plan: Plan; bellhop: boolean; maxComps: number; historyDays: number };

/** The original property and the demo. */
export const EXEMPT_LIMITS: Limits = { plan: 'growth', ...PLAN_LIMITS.growth, maxComps: MAX_COMPS };

/** A trial runs on Growth. */
export function limitsFor(account: Account, propertyId: string): Limits {
  if (isExempt(propertyId)) return EXEMPT_LIMITS;
  const plan = account.plan ?? 'growth';
  return { plan, ...PLAN_LIMITS[plan] };
}

/** Read once per page render; the layout and the page both need it. */
export const requestAccount = cache((propertyId: string) => accountFor(getStore(), propertyId));

export async function limitsForProperty(propertyId: string): Promise<Limits> {
  return limitsFor(await requestAccount(propertyId), propertyId);
}

/**
 * Trim a hotel's watchlist to its plan's cap and email its owners what went.
 * Idempotent. A failed email is only logged; the Competitors page shows the note.
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
