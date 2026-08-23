import { describe, it, expect } from 'vitest';
import { planSearches, RESERVE, RUN_SLOTS_CT } from '../collector/budget';

/**
 * August 2026 is CDT (UTC-5), so UTC noon is 07:00 Central — the first run slot.
 * A 31-day month keeps the days-left arithmetic easy to read in the assertions.
 */
const SLOT_0 = new Date('2026-08-01T12:00:00Z'); // 07:00 CT
const SLOT_1 = new Date('2026-08-01T18:00:00Z'); // 13:00 CT
const SLOT_2 = new Date('2026-08-01T23:00:00Z'); // 18:00 CT

const TOMORROW = '2026-08-02';
const NIGHTS = [TOMORROW, '2026-08-09', '2026-08-15', '2026-08-22'];

describe('planSearches — the ladder at full tier', () => {
  it('spends tomorrow + property details + every event night on the first slot', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: NIGHTS });

    expect(plan.tier).toBe('full');
    expect(plan.compsetDates).toEqual(NIGHTS);
    expect(plan.propertyDetails).toBe(true);
    expect(plan.cost).toBe(5);
    expect(plan.skipped).toEqual([]);
  });

  it('spends tomorrow only on the later slots — parity does not move hourly', () => {
    for (const now of [SLOT_1, SLOT_2]) {
      const plan = planSearches({ remaining: 250, now, dates: NIGHTS });
      expect(plan.compsetDates).toEqual([TOMORROW]);
      expect(plan.propertyDetails).toBe(false);
      expect(plan.cost).toBe(1);
    }
  });

  it('costs 7 searches across a full day', () => {
    const day = [SLOT_0, SLOT_1, SLOT_2]
      .map((now) => planSearches({ remaining: 250, now, dates: NIGHTS }).cost)
      .reduce((a, b) => a + b, 0);
    expect(day).toBe(7);
  });
});

describe('planSearches — degradation', () => {
  it('drops event nights at reduced tier, recording why', () => {
    const plan = planSearches({ remaining: 150, now: SLOT_0, dates: NIGHTS });

    expect(plan.tier).toBe('reduced');
    expect(plan.compsetDates).toEqual([TOMORROW]);
    expect(plan.propertyDetails).toBe(true);
    expect(plan.cost).toBe(2);
    expect(plan.skipped).toEqual([
      { date: '2026-08-09', reason: 'budget' },
      { date: '2026-08-15', reason: 'budget' },
      { date: '2026-08-22', reason: 'budget' },
    ]);
  });

  it('costs 4 searches across a reduced day', () => {
    const day = [SLOT_0, SLOT_1, SLOT_2]
      .map((now) => planSearches({ remaining: 150, now, dates: NIGHTS }).cost)
      .reduce((a, b) => a + b, 0);
    expect(day).toBe(4);
  });

  it('drops parity too at minimal tier, keeping only tomorrow on the first slot', () => {
    const plan = planSearches({ remaining: 100, now: SLOT_0, dates: NIGHTS });

    expect(plan.tier).toBe('minimal');
    expect(plan.compsetDates).toEqual([TOMORROW]);
    expect(plan.propertyDetails).toBe(false);
    expect(plan.cost).toBe(1);
  });

  it('spends nothing on later slots at minimal tier', () => {
    for (const now of [SLOT_1, SLOT_2]) {
      const plan = planSearches({ remaining: 100, now, dates: NIGHTS });
      expect(plan.compsetDates).toEqual([]);
      expect(plan.propertyDetails).toBe(false);
      expect(plan.cost).toBe(0);
    }
  });

  it('never spends when the quota is genuinely gone', () => {
    const plan = planSearches({ remaining: 0, now: SLOT_0, dates: NIGHTS });
    expect(plan.cost).toBe(0);
    expect(plan.compsetDates).toEqual([]);
  });
});

describe('planSearches — tier boundaries', () => {
  // 2026-08-22 leaves 10 days in the month, today inclusive.
  const now = new Date('2026-08-22T12:00:00Z');

  it('is full at exactly daysLeft * 7 spendable', () => {
    expect(planSearches({ remaining: 70 + RESERVE, now, dates: NIGHTS }).tier).toBe('full');
  });

  it('drops to reduced one search below the full threshold', () => {
    expect(planSearches({ remaining: 69 + RESERVE, now, dates: NIGHTS }).tier).toBe('reduced');
  });

  it('is reduced at exactly daysLeft * 4 spendable', () => {
    expect(planSearches({ remaining: 40 + RESERVE, now, dates: NIGHTS }).tier).toBe('reduced');
  });

  it('drops to minimal one search below the reduced threshold', () => {
    expect(planSearches({ remaining: 39 + RESERVE, now, dates: NIGHTS }).tier).toBe('minimal');
  });

  it('recovers as the month runs out faster than the quota does', () => {
    // 55 left with 11 days to go is minimal; the same 50 with 6 days to go is reduced.
    expect(planSearches({ remaining: 55, now: new Date('2026-08-21T12:00:00Z'), dates: NIGHTS }).tier).toBe('minimal');
    expect(planSearches({ remaining: 50, now: new Date('2026-08-26T12:00:00Z'), dates: NIGHTS }).tier).toBe('reduced');
  });

  it('treats a mid-month quota reset as a jump back to full', () => {
    // Anniversary reset on the 22nd: 12 searches left one run, 250 the next.
    expect(planSearches({ remaining: 12, now, dates: NIGHTS }).tier).toBe('minimal');
    expect(planSearches({ remaining: 250, now, dates: NIGHTS }).tier).toBe('full');
  });
});

describe('planSearches — the renewal date, not the calendar month', () => {
  // SerpApi resets on the plan anniversary and reports it as plan_renewal_date.
  // Using calendar month-end instead overspends badly at the end of a month
  // whose renewal is weeks away.
  it('paces against the renewal date when one is given', () => {
    const now = new Date('2026-09-30T12:00:00Z'); // calendar says 1 day left
    const renewalDate = '2026-10-23'; // really 24 days left

    expect(planSearches({ remaining: 27, now, dates: NIGHTS }).tier).toBe('full');
    expect(planSearches({ remaining: 27, now, renewalDate, dates: NIGHTS }).tier).toBe('minimal');
  });

  it('treats the renewal day itself as the last day of the cycle', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(planSearches({ remaining: 27, now, renewalDate: '2026-10-23', dates: NIGHTS }).tier).toBe('full');
  });

  it('falls back to calendar month-end when the renewal date is unknown', () => {
    const now = new Date('2026-08-22T12:00:00Z'); // 10 days left in August
    expect(planSearches({ remaining: 70 + RESERVE, now, dates: NIGHTS }).tier).toBe('full');
    expect(planSearches({ remaining: 69 + RESERVE, now, dates: NIGHTS }).tier).toBe('reduced');
  });

  it('ignores a renewal date already in the past rather than dividing by zero', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    const plan = planSearches({ remaining: 250, now, renewalDate: '2026-08-01', dates: NIGHTS });
    expect(plan.tier).toBe('full');
    expect(plan.cost).toBe(5);
  });
});

describe('planSearches — slot resolution', () => {
  it('treats a run before the first slot as the first slot', () => {
    const early = new Date('2026-08-01T10:00:00Z'); // 05:00 CT
    expect(planSearches({ remaining: 250, now: early, dates: NIGHTS }).cost).toBe(5);
  });

  it('assigns a drifted or manual run to the most recent slot that has passed', () => {
    const drifted = new Date('2026-08-01T18:40:00Z'); // 13:40 CT — slot 1, not slot 0
    const plan = planSearches({ remaining: 250, now: drifted, dates: NIGHTS });
    expect(plan.compsetDates).toEqual([TOMORROW]);
    expect(plan.cost).toBe(1);
  });

  it('exposes the slot times the workflow crons must match', () => {
    expect(RUN_SLOTS_CT).toEqual([7, 13, 18]);
  });
});

describe('planSearches — guards', () => {
  it('caps event nights so the daily budget holds however many dates arrive', () => {
    const many = [TOMORROW, '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: many });

    expect(plan.cost).toBe(5);
    expect(plan.compsetDates).toEqual([TOMORROW, '2026-08-05', '2026-08-06', '2026-08-07']);
    expect(plan.skipped).toEqual([
      { date: '2026-08-08', reason: 'budget' },
      { date: '2026-08-09', reason: 'budget' },
    ]);
  });

  it('handles a bare tomorrow with no event nights', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: [TOMORROW] });
    expect(plan.cost).toBe(2);
    expect(plan.skipped).toEqual([]);
  });

  it('returns an empty plan when given no dates at all', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: [] });
    expect(plan.cost).toBe(0);
    expect(plan.propertyDetails).toBe(false);
  });
});
