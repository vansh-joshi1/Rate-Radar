import type { Store } from './store';
import type { CompsetConfig } from './scoring/compset';
import defaultCompset from '../config/compset.json';

/**
 * Competitor watchlist — store-backed so it's editable from the UI, seeded
 * from config/compset.json on first read. Names double as the substring
 * matchers the compset harvest uses (keep them SHORT: brand + city core —
 * booking sites phrase full names differently). Coordinates come from
 * geocoding on add; entries without coords still match prices, they just
 * don't get a map pin until located.
 */

export interface WatchlistHotel {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  addedAt: string;
}

export const watchlistKey = (propertyId: string) => `prop:${propertyId}:watchlist`;

export async function loadWatchlist(store: Store, propertyId: string): Promise<WatchlistHotel[]> {
  const existing = await store.get<WatchlistHotel[]>(watchlistKey(propertyId));
  if (existing) return existing;
  // First read: seed from the config whitelist so nothing changes behavior
  // until the user actually edits.
  const seeded: WatchlistHotel[] = (defaultCompset.competitors as string[]).map((name) => ({
    name,
    addedAt: new Date(0).toISOString(),
  }));
  await store.set(watchlistKey(propertyId), seeded);
  return seeded;
}

export async function saveWatchlist(store: Store, propertyId: string, hotels: WatchlistHotel[]): Promise<void> {
  await store.set(watchlistKey(propertyId), hotels);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function hasHotel(hotels: WatchlistHotel[], name: string): boolean {
  const needle = normalizeName(name).toLowerCase();
  return hotels.some((h) => h.name.toLowerCase() === needle);
}

/** Watchlist as a compset whitelist (price sanity bounds stay config-defined). */
export function watchlistCompsetConfig(hotels: WatchlistHotel[]): CompsetConfig {
  return {
    competitors: hotels.map((h) => h.name),
    priceSanity: (defaultCompset as CompsetConfig).priceSanity,
  };
}
