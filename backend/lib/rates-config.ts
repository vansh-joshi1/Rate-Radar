import type { Store } from './store';
import defaultRates from '../config/rates.json';

/**
 * Per-property baseline rates — the owner's anchor for every recommendation.
 * Store-backed so it's editable from Settings, seeded from config/rates.json
 * on first read (same pattern as the watchlist). Scoring reads it at ingest
 * time, so edits take effect on the next collection run.
 */

export interface DayRange {
  min: number;
  max: number;
}

export interface TierBaseline {
  id: string;
  label: string;
  weekday: DayRange;
  sunday: DayRange;
  weekend: DayRange;
}

export interface RatesConfig {
  tiers: TierBaseline[];
  upliftCapPct: number;
}

export const DEFAULT_RATES_CONFIG = defaultRates as RatesConfig;

export const ratesConfigKey = (propertyId: string) => `prop:${propertyId}:rates-config`;

export async function loadRatesConfig(store: Store, propertyId: string): Promise<RatesConfig> {
  const existing = await store.get<RatesConfig>(ratesConfigKey(propertyId));
  if (existing) return existing;
  await store.set(ratesConfigKey(propertyId), DEFAULT_RATES_CONFIG);
  return DEFAULT_RATES_CONFIG;
}

export async function saveRatesConfig(store: Store, propertyId: string, cfg: RatesConfig): Promise<void> {
  await store.set(ratesConfigKey(propertyId), cfg);
}

/**
 * A first baseline for a hotel approved from onboarding, from the cheapest
 * rate Google showed for each of its tiers. The config file's numbers are one
 * budget hotel's; seeding a $180 hotel with them would recommend a price cut
 * on every night until someone noticed. The owner tunes these in Settings.
 *
 * ponytail: fixed day-of-week spreads around one observed price. A tier with
 * no price borrows the other tier's, and with no prices at all the config file
 * default stands.
 */
export function baselineFromRooms(rooms: { tier: 'standard' | 'superior'; price: number | null }[]): RatesConfig {
  const cheapest = (tier: string) =>
    Math.min(...rooms.filter((r) => r.tier === tier && r.price !== null).map((r) => r.price!));
  const std = cheapest('standard');
  const sup = cheapest('superior');
  if (!Number.isFinite(std) && !Number.isFinite(sup)) return DEFAULT_RATES_CONFIG;
  const at = (p: number, lo: number, hi: number): DayRange => {
    const clamp = (n: number) => Math.min(1000, Math.max(20, Math.round(n)));
    return { min: clamp(p * lo), max: clamp(p * hi) };
  };
  const tier = (id: string, label: string, p: number): TierBaseline => ({
    id,
    label,
    weekday: at(p, 0.9, 1),
    sunday: at(p, 0.95, 1.05),
    weekend: at(p, 1, 1.15),
  });
  return {
    ...DEFAULT_RATES_CONFIG,
    tiers: [
      tier('standard', 'Standard', Number.isFinite(std) ? std : sup / 1.15),
      tier('superior', 'Superior', Number.isFinite(sup) ? sup : std * 1.15),
    ],
  };
}

const DAY_CLASSES = ['weekday', 'sunday', 'weekend'] as const;

/** Returns a human-readable problem, or null when the config is sound. */
export function validateRatesConfig(cfg: RatesConfig): string | null {
  if (!Array.isArray(cfg.tiers) || cfg.tiers.length === 0) return 'At least one tier is required.';
  if (!Number.isFinite(cfg.upliftCapPct) || cfg.upliftCapPct < 0 || cfg.upliftCapPct > 200) {
    return 'Uplift cap must be between 0 and 200%.';
  }
  const seen = new Set<string>();
  for (const t of cfg.tiers) {
    if (!t.id || !t.label?.trim()) return 'Every tier needs an id and a label.';
    if (seen.has(t.id)) return `Duplicate tier id "${t.id}".`;
    seen.add(t.id);
    for (const cls of DAY_CLASSES) {
      const r = t[cls];
      if (!r || !Number.isFinite(r.min) || !Number.isFinite(r.max)) return `${t.label}: ${cls} needs min and max.`;
      if (r.min < 20 || r.max > 1000) return `${t.label}: ${cls} rates must be between $20 and $1000.`;
      if (r.min > r.max) return `${t.label}: ${cls} min ($${r.min}) is above max ($${r.max}).`;
    }
  }
  return null;
}
