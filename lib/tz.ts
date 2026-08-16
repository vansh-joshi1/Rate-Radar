/**
 * Property-local calendar dates.
 *
 * Deliberately dependency-free so both the server (collector, ingest, pages)
 * and client components can import it — `lib/ingest.ts` pulls in the store and
 * the whole scoring stack, so a browser bundle must never reach for it just to
 * ask what today is.
 *
 * `en-CA` is the trick: it formats as YYYY-MM-DD, so this is a timezone-correct
 * ISO date with no manual arithmetic. Using `toISOString().slice(0, 10)` would
 * report tomorrow all evening for a US property, since UTC has already rolled
 * over — the kind of off-by-one that misprices a night.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone });
}
