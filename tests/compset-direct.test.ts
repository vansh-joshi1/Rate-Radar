import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bookingSlugMatchesName, bookingUrlWithDates } from '../collector/sources/rates';
import { FileStore } from '../lib/store';
import { processBundle, type Bundle } from '../lib/ingest';
import { loadWatchlist, saveWatchlist } from '../lib/watchlist';

describe('bookingUrlWithDates', () => {
  it('appends stay dates, occupancy, and currency', () => {
    expect(bookingUrlWithDates('https://www.booking.com/hotel/us/quality-inn-franklin.html', '2026-08-01')).toBe(
      'https://www.booking.com/hotel/us/quality-inn-franklin.html?checkin=2026-08-01&checkout=2026-08-02&group_adults=2&no_rooms=1&selected_currency=USD'
    );
  });

  it('uses & when the base URL already has a query', () => {
    expect(bookingUrlWithDates('https://www.booking.com/hotel/us/x.html?lang=en', '2026-12-31')).toContain(
      '?lang=en&checkin=2026-12-31&checkout=2027-01-01'
    );
  });
});

describe('bookingSlugMatchesName — search ranking is not identity', () => {
  it('accepts slugs carrying a distinctive name token', () => {
    expect(bookingSlugMatchesName('/hotel/us/quality-inn-and-suites-franklin.html', 'Quality Inn')).toBe(true);
    expect(bookingSlugMatchesName('/hotel/us/la-quinta-cool-springs.html', 'La Quinta')).toBe(true);
    expect(bookingSlugMatchesName('/hotel/us/motel-6-franklin-tn.html', 'Motel 6')).toBe(true);
  });

  it('rejects the observed live failure: Baymont search returning Comfort Inn', () => {
    expect(bookingSlugMatchesName('/hotel/us/comfort-inn-franklin.html', 'Baymont')).toBe(false);
  });

  it('generic tokens alone never prove identity', () => {
    expect(bookingSlugMatchesName('/hotel/us/some-inn-and-suites.html', 'Hampton Inn & Suites')).toBe(false);
  });
});

describe('ingest persists collector-resolved Booking URLs', () => {
  it('fills bookingUrl for matching watchlist hotels, never overwrites existing', async () => {
    const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-cd-')), 'store.json'));
    await saveWatchlist(store, 'rri-franklin', [
      { name: 'Quality Inn', addedAt: 'x' },
      { name: 'Baymont', addedAt: 'x', bookingUrl: 'https://www.booking.com/hotel/us/existing.html' },
    ]);

    const bundle: Bundle = {
      runAt: new Date().toISOString(),
      sources: [
        {
          source: 'rates',
          status: 'ok',
          fetchedAt: new Date().toISOString(),
          data: {
            checks: [],
            compsets: [],
            resolvedBookingUrls: {
              'Quality Inn': 'https://www.booking.com/hotel/us/quality-inn-franklin.html',
              Baymont: 'https://www.booking.com/hotel/us/should-not-overwrite.html',
            },
          },
        },
      ],
    };
    await processBundle(bundle, store);

    const list = await loadWatchlist(store, 'rri-franklin');
    expect(list.find((h) => h.name === 'Quality Inn')?.bookingUrl).toBe(
      'https://www.booking.com/hotel/us/quality-inn-franklin.html'
    );
    expect(list.find((h) => h.name === 'Baymont')?.bookingUrl).toBe('https://www.booking.com/hotel/us/existing.html');
  });
});
