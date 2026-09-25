import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { hasHotel, loadWatchlist, normalizeName, saveWatchlist, watchlistCompsetConfig } from '../lib/watchlist';
import { matchCompset } from '../lib/scoring/compset';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-wl-')), 'store.json'));
}

describe('watchlist store layer', () => {
  it('first read seeds from config/compset.json and persists', async () => {
    const store = freshStore();
    const hotels = await loadWatchlist(store, 'rri-franklin');
    expect(hotels.length).toBeGreaterThan(5);
    expect(hotels.some((h) => h.name === 'Quality Inn')).toBe(true);
    // second read comes from the store, not the config
    await saveWatchlist(store, 'rri-franklin', hotels.slice(0, 2));
    expect(await loadWatchlist(store, 'rri-franklin')).toHaveLength(2);
  });

  it('watchlists are scoped per property', async () => {
    const store = freshStore();
    await saveWatchlist(store, 'hotel-a', [{ name: 'Comfort Inn', addedAt: 'x' }]);
    await saveWatchlist(store, 'hotel-b', [{ name: 'Hampton Inn', addedAt: 'x' }]);
    expect((await loadWatchlist(store, 'hotel-a'))[0].name).toBe('Comfort Inn');
    expect((await loadWatchlist(store, 'hotel-b'))[0].name).toBe('Hampton Inn');
  });

  it('normalizes and dedupes case-insensitively', () => {
    expect(normalizeName('  Fairfield   Inn ')).toBe('Fairfield Inn');
    expect(hasHotel([{ name: 'Fairfield Inn', addedAt: 'x' }], 'fairfield inn')).toBe(true);
    expect(hasHotel([{ name: 'Fairfield Inn', addedAt: 'x' }], 'Fairfield Inn Cool Springs')).toBe(false);
  });

  it('feeds matchCompset: UI-added hotels match, removed ones do not', () => {
    const cfg = watchlistCompsetConfig([
      { name: 'Fairfield Inn', addedAt: 'x' },
      { name: 'Drury Plaza', addedAt: 'x' },
    ]);
    const candidates = [
      { name: 'Fairfield Inn & Suites Franklin Cool Springs', price: 112 },
      { name: 'Drury Plaza Hotel Franklin', price: 128 },
      { name: 'Quality Inn Franklin', price: 79 }, // no longer on the list
      { name: 'Fairfield Inn Bogus', price: 9999 }, // fails price sanity
    ];
    const matched = matchCompset(candidates, cfg);
    expect(matched.map((m) => m.name)).toEqual([
      'Fairfield Inn & Suites Franklin Cool Springs',
      'Drury Plaza Hotel Franklin',
    ]);
  });
});
