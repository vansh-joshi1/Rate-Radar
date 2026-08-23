/**
 * How many SerpApi searches this run is allowed to spend, and on what.
 *
 * The free plan is 250 searches/month and there is no overage — running out
 * means collection stops dead until the anniversary reset. So a run does not
 * "fetch everything"; it draws from a monthly allowance.
 *
 * Two ideas keep this honest:
 *
 *   1. A FIXED LADDER PER SLOT, not a runtime division. Dividing a daily
 *      allowance by "runs left today" overspends, because each run recomputes
 *      from the full allowance and nothing records what earlier runs took.
 *      A fixed per-slot ladder is exactly predictable instead: 5 + 1 + 1.
 *
 *   2. A DEGRADATION TIER read from the live quota. Every run asks SerpApi how
 *      many searches are left, so overspending (extra manual runs, a short
 *      month) shows up immediately and the ladder shrinks rather than the
 *      pipeline erroring. Recovery is automatic too — the month runs out faster
 *      than the quota does.
 *
 * The whole thing is pure: run position comes from the clock against a fixed
 * schedule, so nothing needs to be stored between runs and it is testable
 * without a store.
 */

export type BudgetTier = 'full' | 'reduced' | 'minimal';

export interface SearchPlan {
  tier: BudgetTier;
  /** Dates to fetch a compset for, in order. Tomorrow, when kept, is first. */
  compsetDates: string[];
  /** Fetch our own property's details — per-OTA parity plus room-tier rates. */
  propertyDetails: boolean;
  skipped: { date: string; reason: 'budget' }[];
  /** Searches this plan will spend. */
  cost: number;
}

/** Held back from the monthly allowance so manual runs always have room. */
export const RESERVE = 20;

/**
 * Central-time hours the collect workflow fires. The crons in
 * `.github/workflows/collect.yml` must match — this is the source of truth for
 * both the schedule and the per-slot ladder below.
 */
export const RUN_SLOTS_CT = [7, 13, 18] as const;

/** Event nights beyond this are dropped, so the daily cost holds regardless of caller. */
const MAX_EVENT_NIGHTS = 3;

/** Searches each slot spends per tier — index is the slot, value is the ladder. */
const LADDER: Record<BudgetTier, { tomorrow: boolean; details: boolean; eventNights: boolean }[]> = {
  full: [
    { tomorrow: true, details: true, eventNights: true },
    { tomorrow: true, details: false, eventNights: false },
    { tomorrow: true, details: false, eventNights: false },
  ],
  reduced: [
    { tomorrow: true, details: true, eventNights: false },
    { tomorrow: true, details: false, eventNights: false },
    { tomorrow: true, details: false, eventNights: false },
  ],
  minimal: [
    { tomorrow: true, details: false, eventNights: false },
    { tomorrow: false, details: false, eventNights: false },
    { tomorrow: false, details: false, eventNights: false },
  ],
};

/** Daily cost of each tier's ladder — what the tier thresholds are measured against. */
const DAILY_COST: Record<BudgetTier, number> = { full: 7, reduced: 4, minimal: 1 };

function chicagoParts(now: Date): { hour: number; year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    // Intl renders midnight as "24" in some runtimes; normalise it back to 0.
    hour: Number(parts.hour) % 24,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/**
 * Days remaining in the billing cycle, today inclusive.
 *
 * SerpApi resets on the plan anniversary, not the 1st, and reports it as
 * `plan_renewal_date`. Pacing against calendar month-end instead overspends
 * badly whenever the two disagree — on the 30th with a renewal three weeks out,
 * month-end says "one day left, spend freely" and the quota is gone in four days.
 * Month-end remains the fallback for when the account endpoint is unreachable.
 */
function daysLeftInCycle(now: Date, renewalDate?: string): number {
  const { year, month, day } = chicagoParts(now);
  const todayUtc = Date.UTC(year, month - 1, day);

  if (renewalDate) {
    const [ry, rm, rd] = renewalDate.split('-').map(Number);
    if (ry && rm && rd) {
      const days = Math.round((Date.UTC(ry, rm - 1, rd) - todayUtc) / 86_400_000) + 1;
      if (days > 0) return days;
    }
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return daysInMonth - day + 1;
}

/** Most recent slot that has passed; a run before the first slot belongs to it. */
function slotIndex(hour: number): number {
  let slot = 0;
  for (let i = 0; i < RUN_SLOTS_CT.length; i++) if (hour >= RUN_SLOTS_CT[i]) slot = i;
  return slot;
}

function tierFor(remaining: number, daysLeft: number): BudgetTier {
  const budget = remaining - RESERVE;
  if (budget >= daysLeft * DAILY_COST.full) return 'full';
  if (budget >= daysLeft * DAILY_COST.reduced) return 'reduced';
  return 'minimal';
}

export function planSearches(input: {
  remaining: number;
  now?: Date;
  /** SerpApi's `plan_renewal_date` (YYYY-MM-DD). Falls back to calendar month-end. */
  renewalDate?: string;
  dates: string[];
}): SearchPlan {
  const now = input.now ?? new Date();
  const { hour } = chicagoParts(now);
  const tier = tierFor(input.remaining, daysLeftInCycle(now, input.renewalDate));
  const rung = LADDER[tier][slotIndex(hour)];

  const [tomorrow, ...eventNights] = input.dates;
  const skipped: SearchPlan['skipped'] = [];
  const compsetDates: string[] = [];

  if (tomorrow && rung.tomorrow) compsetDates.push(tomorrow);
  else if (tomorrow) skipped.push({ date: tomorrow, reason: 'budget' });

  for (const [i, date] of eventNights.entries()) {
    if (rung.eventNights && i < MAX_EVENT_NIGHTS) compsetDates.push(date);
    else skipped.push({ date, reason: 'budget' });
  }

  const propertyDetails = rung.details && input.dates.length > 0;
  const cost = compsetDates.length + (propertyDetails ? 1 : 0);

  // A near-exhausted quota must not be spent at all — the tier floor is 1/day,
  // which is still one search too many when there are none left.
  if (cost > input.remaining) {
    return { tier, compsetDates: [], propertyDetails: false, cost: 0, skipped };
  }

  return { tier, compsetDates, propertyDetails, skipped, cost };
}
