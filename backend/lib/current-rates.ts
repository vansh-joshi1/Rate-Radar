import type { Store } from './store';

/**
 * Owner-entered current rates — what the property is actually charging right
 * now, per tier. The owner sets prices, so this is the authoritative "your
 * rate" for market-position comparisons; the scraped direct rate (when the
 * bot walls allow one) remains the external verification shown in parity.
 */

export interface CurrentRates {
  /** tierId → nightly rate in USD. */
  tiers: Record<string, number>;
  updatedAt: string;
}

export const currentRatesKey = (propertyId: string) => `prop:${propertyId}:current-rates`;

export async function loadCurrentRates(store: Store, propertyId: string): Promise<CurrentRates | null> {
  return store.get<CurrentRates>(currentRatesKey(propertyId));
}

export async function saveCurrentRates(store: Store, propertyId: string, rates: CurrentRates): Promise<void> {
  await store.set(currentRatesKey(propertyId), rates);
}

export function validateCurrentRates(tiers: Record<string, number>): string | null {
  const entries = Object.entries(tiers);
  if (entries.length === 0) return 'At least one tier rate is required.';
  for (const [tierId, price] of entries) {
    if (!tierId) return 'Tier id missing.';
    if (!Number.isFinite(price) || price < 20 || price > 1000) {
      return `${tierId}: rate must be between $20 and $1000.`;
    }
  }
  return null;
}
