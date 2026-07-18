import compsetConfig from '../../config/compset.json';
import type { CompsetEntry, TierRecommendation } from './types';

const CAP_MULTIPLIER = 1.15;
const EVENT_SCORE_FLOOR = 40; // nights at/above this are never capped

export interface CompsetConfig {
  competitors: string[];
  priceSanity: { min: number; max: number };
}

/** Keep only whitelisted competitors with sane prices. Defaults to config/compset.json; multi-property collectors pass their own whitelist. */
export function matchCompset(candidates: CompsetEntry[], config: CompsetConfig = compsetConfig): CompsetEntry[] {
  const { competitors, priceSanity } = config;
  return candidates.filter(
    (c) =>
      c.price >= priceSanity.min &&
      c.price <= priceSanity.max &&
      competitors.some((w) => c.name.toLowerCase().includes(w.toLowerCase()))
  );
}

export function compsetMedian(entries: CompsetEntry[]): number | null {
  if (entries.length === 0) return null;
  const sorted = entries.map((e) => e.price).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compset is a sanity BOUND, not a demand driver. On quiet nights
 * (score < 40) the recommendation is capped at 1.15 × compset median —
 * but never below the tier's baseline floor. Event nights are never capped:
 * comps posted their rates before the demand signal existed, and charging
 * the event premium is the whole point.
 */
export function applyCompsetBound(
  tiers: TierRecommendation[],
  nightScore: number,
  median: number | null
): { tiers: TierRecommendation[]; note?: string } {
  if (median == null) return { tiers };

  if (nightScore >= EVENT_SCORE_FLOOR) {
    return {
      tiers,
      note: `Nearby competitors' median is $${median}, but this night has real event demand (score ${nightScore}) — not capped; comps posted rates before the demand signal.`,
    };
  }

  const cap = median * CAP_MULTIPLIER;
  let capped = false;
  const adjusted = tiers.map((t) => {
    const floor = t.range[0];
    if (t.recommended <= cap) return t;
    const bounded = Math.max(floor, Math.round(cap));
    if (bounded < t.recommended) capped = true;
    return { ...t, recommended: bounded, range: [floor, Math.max(floor, Math.min(t.range[1], Math.round(cap)))] as [number, number] };
  });

  return {
    tiers: adjusted,
    note: capped
      ? `Nearby competitors' median is $${median} tonight — recommendation capped at ~115% of market (never below your baseline floor).`
      : `Nearby competitors' median is $${median} — recommendation is within a sane distance of market.`,
  };
}
