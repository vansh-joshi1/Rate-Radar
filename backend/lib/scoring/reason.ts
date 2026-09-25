import type { NightRecommendation, ScoredEvent } from './types';

function eventLine(e: ScoredEvent): string {
  const est = e.attendanceEstimate >= 1000
    ? `~${Math.round(e.attendanceEstimate / 1000)}k expected`
    : `~${e.attendanceEstimate} expected`;
  return `${e.name} at ${e.venue} (${est}, score ${e.score}): ${e.verdict}.`;
}

/**
 * Plain-language reasoning for one night. Every considered event appears —
 * including those judged too small to matter. Nothing is silently omitted.
 */
export function buildReasoning(n: Omit<NightRecommendation, 'reasoning'>): string[] {
  const lines: string[] = [];

  const priced = n.events.filter((e) => e.tier === 'meaningful' || e.tier === 'major');
  const noted = n.events.filter((e) => e.tier === 'minor' || e.tier === 'too-small');

  if (n.events.length === 0) {
    lines.push('No demand-relevant events found for this night — baseline day-of-week pricing applies.');
  }
  for (const e of priced) lines.push(eventLine(e));
  if (priced.length > 1) {
    lines.push(
      `Multiple simultaneous demand drivers compound to a night score of ${n.nightScore} (diminishing returns, not a straight sum).`
    );
  }
  for (const e of noted) lines.push(eventLine(e));

  if (n.holidayName) lines.push(`Holiday period: ${n.holidayName}.`);
  if (n.weatherNote) lines.push(n.weatherNote);
  if (n.bnaNote) lines.push(n.bnaNote);

  if (n.upliftPct > 0) {
    lines.push(`Recommended uplift: +${n.upliftPct}% over the day-of-week baseline.`);
  } else if (n.events.length > 0) {
    lines.push('Nothing above rises to the level of a rate move — baseline pricing recommended.');
  }
  return lines;
}
