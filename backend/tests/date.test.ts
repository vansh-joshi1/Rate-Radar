import { describe, it, expect } from 'vitest';
import {
  noonUTC, toIsoDate, todayIn, addDays, dateRange, dayOfWeek,
  fmtDay, fmtDow, fmtDowDay, fmtDowDayYear, fmtWeekdayLong,
  fmtMonthYear, fmtMonthYearLong, fmtRange,
} from '../lib/date';

/*
 * These lock the exact strings the helpers produced at the call sites they
 * were consolidated from. The point is not that the formats are good — it is
 * that a later edit to lib/date.ts cannot quietly change what a dashboard
 * renders or what an alert email says.
 */

describe('noonUTC', () => {
  it('anchors at midday UTC, so the US never reads the day before', () => {
    expect(noonUTC('2026-09-22').toISOString()).toBe('2026-09-22T12:00:00.000Z');
  });

  it('stays on the named day in US timezones', () => {
    expect(noonUTC('2026-09-22').toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }))
      .toBe('2026-09-22');
  });
});

describe('toIsoDate', () => {
  it('renders a Date back to YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2026-09-22T12:00:00Z'))).toBe('2026-09-22');
  });
});

describe('todayIn', () => {
  it('reports the property-local day, not the UTC one', () => {
    // 01:30 UTC on the 23rd is still the evening of the 22nd in Chicago.
    const instant = new Date('2026-09-23T01:30:00Z');
    expect(todayIn('America/Chicago', instant)).toBe('2026-09-22');
    expect(todayIn('UTC', instant)).toBe('2026-09-23');
  });
});

describe('addDays', () => {
  it('walks forward and back', () => {
    expect(addDays('2026-09-22', 1)).toBe('2026-09-23');
    expect(addDays('2026-09-22', -1)).toBe('2026-09-21');
    expect(addDays('2026-09-22', 0)).toBe('2026-09-22');
  });

  it('crosses months and years', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('crosses a US DST boundary without slipping a day', () => {
    // DST ends 2026-11-01 in America/Chicago — the noon anchor absorbs it.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('dateRange', () => {
  it('returns consecutive days starting at `from`, inclusive', () => {
    expect(dateRange('2026-09-22', 5)).toEqual([
      '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
    ]);
  });

  it('returns nothing for a zero-length window', () => {
    expect(dateRange('2026-09-22', 0)).toEqual([]);
  });
});

describe('dayOfWeek', () => {
  it('numbers Sunday 0 through Saturday 6', () => {
    expect(dayOfWeek('2026-09-20')).toBe(0); // Sunday
    expect(dayOfWeek('2026-09-22')).toBe(2); // Tuesday
    expect(dayOfWeek('2026-09-26')).toBe(6); // Saturday
  });
});

describe('formatters', () => {
  const d = '2026-09-22';

  it('renders each option set exactly as its call sites did', () => {
    expect(fmtDay(d)).toBe('Sep 22');
    expect(fmtDow(d)).toBe('Tue');
    expect(fmtDowDay(d)).toBe('Tue, Sep 22');
    expect(fmtDowDayYear(d)).toBe('Tue, Sep 22, 2026');
    expect(fmtWeekdayLong(d)).toBe('Tuesday, September 22');
    expect(fmtMonthYear(d)).toBe('Sep 2026');
    expect(fmtMonthYearLong(d)).toBe('September 2026');
  });

  it('accepts a Date as well as a date string', () => {
    expect(fmtMonthYearLong(new Date(Date.UTC(2026, 8, 1, 12)))).toBe('September 2026');
    expect(fmtDay(new Date(Date.UTC(2026, 8, 22, 12)))).toBe('Sep 22');
  });

  it('states the year once, from the end of a range', () => {
    expect(fmtRange('2026-09-22', '2026-10-13')).toBe('Sep 22 - Oct 13, 2026');
  });

  it('formats in UTC, not the viewer timezone', () => {
    // Late-evening UTC would be the next day east of UTC if the zone leaked in.
    expect(fmtDay('2026-12-31')).toBe('Dec 31');
    expect(fmtMonthYear('2026-12-31')).toBe('Dec 2026');
  });
});
