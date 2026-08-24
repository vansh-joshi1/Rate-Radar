/**
 * How many SerpApi searches this run is allowed to spend, and on what.
 *
 * The free plan is 250 searches/month with no overage — running out means
 * collection stops dead until the anniversary reset. So a run does not "fetch
 * everything"; it draws from a monthly allowance.
 *
 * Three ideas keep this honest:
 *
 *   1. A ROLLING HORIZON STARTING TODAY. The Overview's headline recommendation
 *      is for tonight, and tonight used to be the one night never priced —
 *      the most-read number had no competitor bound under it. The horizon now
 *      starts at today and runs forward, which also replaced the old
 *      event-night picking: those nights scored >= 40, and applyCompsetBound
 *      never caps a night scoring >= 40, so their searches only ever produced
 *      an informational note and never moved a price.
 *
 *   2. A FIXED LADDER PER SLOT, not a runtime division. Dividing a daily
 *      allowance by "runs left today" overspends, because each run recomputes
 *      from the full allowance and nothing records what earlier runs took.
 *      A fixed per-slot ladder is exactly predictable instead: 6 + 1.
 *
 *   3. A DEGRADATION TIER read from the live quota. Every run asks SerpApi how
 *      many searches are left, so overspending (extra manual runs, a short
 *      month) shows up immediately and the horizon shrinks rather than the
 *      pipeline erroring. Recovery is automatic — the cycle runs down faster
 *      than the quota does.
 *
 * The whole thing is pure: run position comes from the clock against a fixed
 * schedule, so nothing is stored between runs and it tests without a store.
 */

export type BudgetTier = 'full' | 'reduced' | 'minimal';

export interface SearchPlan {
  tier: BudgetTier;
  /** Dates to fetch a compset for, in order. Today, when kept, is first. */
  compsetDates: string[];
  /** Fetch our own property's details — per-channel parity plus room-tier rates. */
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
export const RUN_SLOTS_CT = [7, 13] as const;

/** Nights priced ahead, counting tonight. Five is what 250 searches/month buys. */
export const HORIZON_DAYS = 5;

/** Tonight plus the next HORIZON_DAYS-1 nights, as YYYY-MM-DD. */
export function horizonDates(today: string, days = HORIZON_DAYS): string[] {
  const base = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** How many horizon dates each slot prices, per tier, and whether it buys parity. */
const LADDER: Record<BudgetTier, { dates: number; details: boolean }[]> = {
  // 07:00 → whole horizon + parity (6). 13:00 → tonight only (1). = 7/day
  full: [
    { dates: HORIZON_DAYS, details: true },
    { dates: 1, details: false },
  ],
  // 07:00 → tonight + tomorrow + parity (3). 13:00 → tonight (1). = 4/day
  reduced: [
    { dates: 2, details: true },
    { dates: 1, details: false },
  ],
  // 07:00 → tonight (1). 13:00 → nothing. = 1/day
  minimal: [
    { dates: 1, details: false },
    { dates: 0, details: false },
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
 * month-end says one day is left and the ladder drains the quota in four days.
 * Month-end remains the fallback for an unreachable `/account`.
 */
function daysLeftInCycle(now: Date, renewalDate?: string): number {
  const { year, month, day } = chicagoParts(now);
  const todayUtc = Date.UTC(year, month - 1, day);

  if (renewalDate) {
    const [ry, rm, rd] = renewalDate.split('-').map(Number);
    if (ry && rm && rd) {
      // Exclusive of the renewal day: the quota resets ON that date, so it is
      // funded by the next cycle, not this one. Counting it made a fresh 250
      // fail to cover its own cycle — 32 days x 7 = 224 against 230 spendable,
      // so one manual run pinned the whole month in 'reduced'.
      const days = Math.round((Date.UTC(ry, rm - 1, rd) - todayUtc) / 86_400_000);
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
  /** The horizon, nearest night first — normally horizonDates(today). */
  dates: string[];
}): SearchPlan {
  const now = input.now ?? new Date();
  const { hour } = chicagoParts(now);
  const tier = tierFor(input.remaining, daysLeftInCycle(now, input.renewalDate));
  const rung = LADDER[tier][slotIndex(hour)];

  // Never price more of the horizon than the ladder allows, however many dates
  // the caller passes — the daily cost has to hold for the tier maths to mean anything.
  const take = Math.min(rung.dates, HORIZON_DAYS, input.dates.length);
  const compsetDates = input.dates.slice(0, take);
  const skipped = input.dates.slice(take).map((date) => ({ date, reason: 'budget' as const }));

  const propertyDetails = rung.details && input.dates.length > 0;
  const cost = compsetDates.length + (propertyDetails ? 1 : 0);

  // A near-exhausted quota must not be spent at all — the tier floor is 1/day,
  // which is still one search too many when there are none left.
  if (cost > input.remaining) {
    return { tier, compsetDates: [], propertyDetails: false, cost: 0, skipped };
  }

  return { tier, compsetDates, propertyDetails, skipped, cost };
}
