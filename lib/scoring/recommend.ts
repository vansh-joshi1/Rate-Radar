import ratesConfig from '../../config/rates.json';
import type { SourceResult, TierRecommendation } from './types';

const UPLIFT_START_SCORE = 40;
const UPLIFT_MIN_PCT = 5;

/** Night score → uplift %. Zero below 40 (minor events never move the price). */
export function upliftPct(score: number): number {
  if (score < UPLIFT_START_SCORE) return 0;
  const cap = ratesConfig.upliftCapPct;
  return (
    Math.round(
      (UPLIFT_MIN_PCT + ((score - UPLIFT_START_SCORE) / (100 - UPLIFT_START_SCORE)) * (cap - UPLIFT_MIN_PCT)) * 10
    ) / 10
  );
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function recommendNight(date: string, nightScore: number): TierRecommendation[] {
  const isWeekend = (ratesConfig.weekendDays as number[]).includes(dayOfWeek(date));
  const u = 1 + upliftPct(nightScore) / 100;
  return ratesConfig.tiers.map((t) => {
    const base = isWeekend ? t.weekend : t.weekday;
    const mid = (base.min + base.max) / 2;
    return {
      tierId: t.id,
      label: t.label,
      baselineMid: mid,
      recommended: Math.round(mid * u),
      range: [Math.round(base.min * u), Math.round(base.max * u)] as [number, number],
    };
  });
}

/** Importance weights per collector — must sum to 1. */
const WEIGHTS: Record<string, number> = {
  rates: 0.3,
  ticketmaster: 0.25,
  cfbd: 0.1,
  nws: 0.1,
  faa: 0.05,
  calendars: 0.15,
  holidays: 0.05,
};

export function confidence(sources: SourceResult[]): { value: number; note: string } {
  let value = 0;
  const down: string[] = [];
  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const s = sources.find((x) => x.source === name);
    if (s?.status === 'ok') value += weight;
    else down.push(`${name}${s?.status === 'awaiting-key' ? ' (awaiting API key)' : ''}`);
  }
  const pct = Math.round(value * 100);
  const note =
    down.length === 0
      ? 'All data sources reporting.'
      : `Reduced confidence — source(s) not reporting this run: ${down.join(', ')}.`;
  return { value: pct, note };
}
