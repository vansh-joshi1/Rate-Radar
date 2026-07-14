import { scoreEvent, nightScore } from '../lib/scoring/score';
import type { RawEvent } from '../lib/scoring/types';

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Pick the upcoming nights worth a compset fetch: nights in (tomorrow, today+21]
 * whose compound score reaches the "affects the rate" line (>= 40). Tomorrow is
 * excluded because it always gets fetched anyway. Capped to keep the Playwright
 * stage cheap; nearest nights first (the most actionable ones).
 */
export function pickCompsetDates(events: RawEvent[], today: string, max = 3): string[] {
  const tomorrow = addDays(today, 1);
  const byNight = new Map<string, number[]>();
  for (const e of events) {
    if (e.date <= tomorrow || e.date > addDays(today, 21)) continue;
    (byNight.get(e.date) ?? byNight.set(e.date, []).get(e.date)!).push(scoreEvent(e).score);
  }
  return [...byNight.entries()]
    .map(([date, scores]) => ({ date, score: nightScore(scores.map((s) => ({ score: s }))) }))
    .filter((n) => n.score >= 40)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, max)
    .map((n) => n.date);
}
