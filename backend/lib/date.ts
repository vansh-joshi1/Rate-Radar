/**
 * Calendar dates — the one place that knows how this project turns a
 * `YYYY-MM-DD` string into a Date, walks it forward, and renders it.
 *
 * Deliberately dependency-free so both the server (collector, ingest, pages)
 * and client components can import it — `lib/ingest.ts` pulls in the store and
 * the whole scoring stack, so a browser bundle must never reach for it just to
 * ask what today is.
 *
 * Two rules everything here follows:
 *
 *   NOON UTC, NOT MIDNIGHT. A bare `new Date('2026-09-22')` is midnight UTC,
 *   which is the previous evening in every US timezone — so formatting it with
 *   a local timezone prints the wrong day. Anchoring at 12:00Z puts the whole
 *   US inside the same calendar day whichever way the offset runs.
 *
 *   FORMATTERS PIN timeZone: 'UTC'. A date string names a calendar day, not an
 *   instant; rendering it in the viewer's zone would shift it by a day for
 *   anyone east of UTC.
 */

/** A `YYYY-MM-DD` calendar day, or an instant that already means the right day. */
type DateLike = string | Date;

/**
 * Midday UTC on the given calendar day — the anchor every date helper uses.
 * See the module note: midnight would read as the day before across the US.
 */
export function noonUTC(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** Back to `YYYY-MM-DD`. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function asDate(d: DateLike): Date {
  return typeof d === 'string' ? noonUTC(d) : d;
}

/**
 * Today in a property's own timezone.
 *
 * `en-CA` is the trick: it formats as YYYY-MM-DD, so this is a timezone-correct
 * ISO date with no manual arithmetic. Using `toISOString().slice(0, 10)` would
 * report tomorrow all evening for a US property, since UTC has already rolled
 * over — the kind of off-by-one that misprices a night.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone });
}

/** The calendar day `n` days after `date` (negative walks back). */
export function addDays(date: string, n: number): string {
  const d = noonUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return toIsoDate(d);
}

/** `count` consecutive days starting at `from`, inclusive. */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  return noonUTC(date).getUTCDay();
}

/* --- formatters ---------------------------------------------------------
 *
 * One export per distinct option set in the app, not one per call site. Each
 * keeps the exact options its callers used before they were consolidated —
 * changing rendered text is not what a refactor is for.
 */

/** `Sep 22` */
export const fmtDay = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** `Tue` */
export const fmtDow = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/** `Tue, Sep 22` */
export const fmtDowDay = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

/** `Tue, Sep 22, 2026` */
export const fmtDowDayYear = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

/** `Tuesday, September 22` */
export const fmtWeekdayLong = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

/** `Sep 2026` */
export const fmtMonthYear = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `September 2026` */
export const fmtMonthYearLong = (d: DateLike): string =>
  asDate(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `Sep 22 - Oct 13, 2026` — the year stated once, from the end of the range. */
export const fmtRange = (from: DateLike, to: DateLike): string =>
  `${fmtDay(from)} - ${fmtDay(to)}, ${asDate(to).getUTCFullYear()}`;
