import type { Property } from '../properties';
import type { HistoryRecord, Snapshot } from '../scoring/types';
import type { Bookings } from '../bookings';
import { fmtDowDay, fmtWeekdayLong } from '../date';

export interface BellhopContext {
  property: Property;
  /** Tonight, YYYY-MM-DD in the property's timezone. */
  today: string;
  snapshot: Snapshot | null;
  history: HistoryRecord[];
  actuals: Record<string, Record<string, number>>;
  bookings: Bookings;
}

const RULES = `You are Bellhop, the assistant inside Rate Radar, a revenue tool for small independent hotels.
You answer the hotel's staff about the rate recommendations Rate Radar has already computed.

Rules — these are the product, not style:
- Answer ONLY from the DATA below. Quote its numbers and its reasoning lines. If the data does not cover the question, say so plainly; never fill the gap with a guess or outside knowledge.
- You explain recommendations; you do not make them. The engine is deterministic and its arithmetic is in the data.
- For "what if I charge $X": compare $X to the night's recommended rate and range, the compset median, and the night's events and notes. Never predict occupancy, bookings, pickup or revenue — Rate Radar has no demand model, and you must say that if asked.
- Rate Radar never changes a price anywhere. Never say or imply that you or it will set, push or apply a rate. The human decides.
- Events judged "too small to matter" are part of the answer when relevant — say they were considered and why they did not move the number.
- Plain, practical language for a hotel operator, not an analyst. Short answers; dollars without cents unless the data has them. Dates as weekday + month/day.
- Plain text only. The chat does not render markdown: no asterisks, no headings, no tables. For a list, put each item on its own line starting with "- ".`;

/**
 * The whole system prompt for one question. Everything is inlined: a 21-night
 * snapshot plus a month of history is small enough that retrieval would be
 * machinery with nothing to do.
 */
export function buildSystemPrompt(ctx: BellhopContext): string {
  const { property, today, snapshot } = ctx;
  const header = `Property: ${property.name}, ${property.city}. ${property.totalRooms} rooms. Tonight is ${fmtWeekdayLong(today)} (${today}, ${property.timezone}).`;

  const data = snapshot
    ? JSON.stringify({
        runAt: snapshot.runAt,
        confidence: snapshot.confidence,
        confidenceNote: snapshot.confidenceNote,
        // Spelled-out day: left to derive it from the date, the model called a Friday "Thursday".
        nights: snapshot.nights.map((n) => ({ day: fmtDowDay(n.date), ...n })),
        compsets: snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : []),
        parity: snapshot.parity,
        // Health only — raw payloads are large and say nothing the nights don't.
        sources: snapshot.sources.map(({ source, status, error }) => ({ source, status, error })),
      })
    : 'NO SNAPSHOT: the collector has not produced a run for this property yet. Tell the user there is no data to answer from.';

  return [
    RULES,
    header,
    `LATEST SNAPSHOT:\n${data}`,
    `RECENT HISTORY (what was recommended per night):\n${JSON.stringify(ctx.history)}`,
    `ACTUALS (rate the hotel actually charged, by night and tier):\n${JSON.stringify(ctx.actuals)}`,
    `ROOMS BOOKED READINGS (by night; latest reading is the current figure, earlier ones are pace):\n${JSON.stringify(ctx.bookings)}`,
  ].join('\n\n');
}
