import { describe, it, expect } from 'vitest';
import { planSearches, horizonDates, RESERVE, RUN_SLOTS_CT, HORIZON_DAYS } from '../collector/budget';

/**
 * August 2026 is CDT (UTC-5), so UTC noon is 07:00 Central — the first run slot.
 * A 31-day month keeps the days-left arithmetic easy to read in the assertions.
 */
const SLOT_0 = new Date('2026-08-01T12:00:00Z'); // 07:00 CT
const SLOT_1 = new Date('2026-08-01T18:00:00Z'); // 13:00 CT

const TODAY = '2026-08-01';
const WEEK = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];

describe('horizonDates', () => {
  it('runs from today forward, not from tomorrow', () => {
    // The Overview headline recommends TONIGHT, so tonight is the one night that
    // most needs a competitor price. It was the only night never fetched.
    expect(horizonDates('2026-08-01')).toEqual(WEEK);
    expect(horizonDates('2026-08-01')[0]).toBe('2026-08-01');
  });

  it('crosses a month boundary without arithmetic drift', () => {
    expect(horizonDates('2026-08-30')).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    ]);
  });

  it('is exactly HORIZON_DAYS long', () => {
    expect(horizonDates('2026-08-01')).toHaveLength(HORIZON_DAYS);
  });
});

describe('planSearches — full tier', () => {
  it('prices the whole horizon plus parity on the morning run', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: WEEK });

    expect(plan.tier).toBe('full');
    expect(plan.compsetDates).toEqual(WEEK);
    expect(plan.propertyDetails).toBe(true);
    expect(plan.cost).toBe(6);
    expect(plan.skipped).toEqual([]);
  });

  it('refreshes only tonight at midday — the one price still worth acting on', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_1, dates: WEEK });

    expect(plan.compsetDates).toEqual([TODAY]);
    expect(plan.propertyDetails).toBe(false);
    expect(plan.cost).toBe(1);
    expect(plan.skipped.map((s) => s.date)).toEqual(WEEK.slice(1));
  });

  it('costs 7 searches across a full day', () => {
    const day = [SLOT_0, SLOT_1]
      .map((now) => planSearches({ remaining: 250, now, dates: WEEK }).cost)
      .reduce((a, b) => a + b, 0);
    expect(day).toBe(7);
  });
});

describe('planSearches — degradation', () => {
  it('shrinks the horizon to today and tomorrow at reduced tier', () => {
    const plan = planSearches({ remaining: 150, now: SLOT_0, dates: WEEK });

    expect(plan.tier).toBe('reduced');
    expect(plan.compsetDates).toEqual(['2026-08-01', '2026-08-02']);
    expect(plan.propertyDetails).toBe(true);
    expect(plan.cost).toBe(3);
    expect(plan.skipped.map((s) => s.date)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('costs 4 searches across a reduced day', () => {
    const day = [SLOT_0, SLOT_1]
      .map((now) => planSearches({ remaining: 150, now, dates: WEEK }).cost)
      .reduce((a, b) => a + b, 0);
    expect(day).toBe(4);
  });

  it('keeps only tonight at minimal tier, and drops parity', () => {
    const plan = planSearches({ remaining: 100, now: SLOT_0, dates: WEEK });

    expect(plan.tier).toBe('minimal');
    expect(plan.compsetDates).toEqual([TODAY]);
    expect(plan.propertyDetails).toBe(false);
    expect(plan.cost).toBe(1);
  });

  it('spends nothing on the midday run at minimal tier', () => {
    expect(planSearches({ remaining: 100, now: SLOT_1, dates: WEEK }).cost).toBe(0);
  });

  it('never spends when the quota is genuinely gone', () => {
    const plan = planSearches({ remaining: 0, now: SLOT_0, dates: WEEK });
    expect(plan.cost).toBe(0);
    expect(plan.compsetDates).toEqual([]);
  });

  it('always keeps tonight whenever it spends anything at all', () => {
    for (const remaining of [250, 150, 100, 30]) {
      const plan = planSearches({ remaining, now: SLOT_0, dates: WEEK });
      if (plan.cost > 0) expect(plan.compsetDates[0]).toBe(TODAY);
    }
  });
});

describe('planSearches — tier boundaries', () => {
  // 2026-08-22 leaves 10 days in the month, today inclusive.
  const now = new Date('2026-08-22T12:00:00Z');

  it('is full at exactly daysLeft * 7 spendable', () => {
    expect(planSearches({ remaining: 70 + RESERVE, now, dates: WEEK }).tier).toBe('full');
  });

  it('drops to reduced one search below the full threshold', () => {
    expect(planSearches({ remaining: 69 + RESERVE, now, dates: WEEK }).tier).toBe('reduced');
  });

  it('is reduced at exactly daysLeft * 4 spendable', () => {
    expect(planSearches({ remaining: 40 + RESERVE, now, dates: WEEK }).tier).toBe('reduced');
  });

  it('drops to minimal one search below the reduced threshold', () => {
    expect(planSearches({ remaining: 39 + RESERVE, now, dates: WEEK }).tier).toBe('minimal');
  });
});

describe('planSearches — the renewal date, not the calendar month', () => {
  it('paces against the renewal date when one is given', () => {
    const now = new Date('2026-09-30T12:00:00Z'); // calendar says 1 day left
    const renewalDate = '2026-10-23'; // really 24 days left

    expect(planSearches({ remaining: 27, now, dates: WEEK }).tier).toBe('full');
    expect(planSearches({ remaining: 27, now, renewalDate, dates: WEEK }).tier).toBe('minimal');
  });

  it('treats the renewal day as belonging to the next cycle, not this one', () => {
    // The quota RESETS on the renewal date, so that day is not one this cycle
    // has to fund. Counting it made a fresh 250 fail to cover its own cycle:
    // Aug 23 → Sep 23 counted as 32 days needs 224, but only 230 is spendable,
    // so a single manual run pinned the whole month in 'reduced'.
    expect(
      planSearches({ remaining: 243, now: new Date('2026-08-23T12:00:00Z'), renewalDate: '2026-09-23', dates: WEEK }).tier
    ).toBe('full');
  });

  it('still plans on the renewal day itself rather than dividing by zero', () => {
    // Renewal day leaves zero days in the outgoing cycle, so pacing falls back
    // to calendar month-end. The quota has just reset, so this reads as full.
    const now = new Date('2026-10-23T12:00:00Z');
    const plan = planSearches({ remaining: 250, now, renewalDate: '2026-10-23', dates: WEEK });
    expect(plan.tier).toBe('full');
    expect(plan.cost).toBe(6);
  });

  it('degrades on a nearly-spent quota however many days are left', () => {
    // 27 searches is under a week of the full ladder — minimal is correct here,
    // and used to read as 'full' only because the cycle was counted a day long.
    const now = new Date('2026-10-23T12:00:00Z');
    expect(planSearches({ remaining: 27, now, renewalDate: '2026-11-23', dates: WEEK }).tier).toBe('minimal');
  });

  it('leaves a full cycle affordable on a fresh quota', () => {
    // The ladder must fit the plan it was designed for, with room for the reserve.
    expect(
      planSearches({ remaining: 250, now: new Date('2026-08-23T12:00:00Z'), renewalDate: '2026-09-23', dates: WEEK }).tier
    ).toBe('full');
  });

  it('ignores a renewal date already in the past rather than dividing by zero', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    const plan = planSearches({ remaining: 250, now, renewalDate: '2026-08-01', dates: WEEK });
    expect(plan.tier).toBe('full');
    expect(plan.cost).toBe(6);
  });
});

describe('planSearches — slot resolution', () => {
  it('treats a run before the first slot as the first slot', () => {
    const early = new Date('2026-08-01T10:00:00Z'); // 05:00 CT
    expect(planSearches({ remaining: 250, now: early, dates: WEEK }).cost).toBe(6);
  });

  it('assigns a drifted or manual run to the most recent slot that has passed', () => {
    const evening = new Date('2026-08-01T23:00:00Z'); // 18:00 CT — after the last slot
    expect(planSearches({ remaining: 250, now: evening, dates: WEEK }).cost).toBe(1);
  });

  it('puts the winter midday run (12:07 CST) in the 13:00 slot', () => {
    const winterNoon = new Date('2026-12-01T18:07:00Z'); // 12:07 CST
    expect(planSearches({ remaining: 250, now: winterNoon, dates: WEEK }).cost).toBe(1);
  });

  it('exposes the two slot times the workflow crons must match', () => {
    expect(RUN_SLOTS_CT).toEqual([7, 13]);
  });
});

describe('planSearches — guards', () => {
  it('caps the horizon so the daily budget holds however many dates arrive', () => {
    const tooMany = [...WEEK, '2026-08-06', '2026-08-07'];
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: tooMany });

    expect(plan.cost).toBe(6);
    expect(plan.compsetDates).toEqual(WEEK);
    expect(plan.skipped.map((s) => s.date)).toEqual(['2026-08-06', '2026-08-07']);
  });

  it('returns an empty plan when given no dates at all', () => {
    const plan = planSearches({ remaining: 250, now: SLOT_0, dates: [] });
    expect(plan.cost).toBe(0);
    expect(plan.propertyDetails).toBe(false);
  });
});
