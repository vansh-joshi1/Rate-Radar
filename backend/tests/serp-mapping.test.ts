import { describe, it, expect } from 'vitest';
import { toCompsetEntries, toParityChecks, toRoomRates } from '../collector/sources/rates';
import type { SerpProperty, SerpPropertyDetails } from '../collector/sources/serpapi';
import type { RoomTierRule } from '../collector/properties';
import type { CompsetConfig } from '../lib/scoring/compset';
import search from './fixtures/serp-search-kestrel.json';
import detail from './fixtures/serp-detail-harborpine.json';

/**
 * Fixtures are synthetic: real SerpApi response shape, invented market (the
 * Kestrel Bay world in lib/demo.ts). Prices, ordering, channel count and the
 * awkward edges — a reseller under our direct rate, one room listed at two
 * prices on two channels, SerpApi's stray whitespace — are all preserved, so
 * these assertions test exactly what they tested against the live capture.
 */
const PROPERTIES = search.properties as SerpProperty[];
const DETAIL = detail as SerpPropertyDetails;

const OURS = PROPERTIES.find((p) => /harbor pine/i.test(p.name ?? ''))!;

const COMPSET: CompsetConfig = {
  competitors: [
    'Rivermark Lodge Harbor',
    'Cormorant Court',
    'The Anchorage Hotel',
    'Lantern Bay Suites',
    'Pinecrest Inn',
    'Gull Point',
    'Tidewater Inn',
    'Beacon Rest',
    'Dockside Motel',
    'Nyx by Wavecrest',
  ],
  priceSanity: { min: 40, max: 250 },
};

const TIER_MAP: RoomTierRule[] = [
  { match: 'superior', tierId: 'superior' },
  { match: '*', tierId: 'standard' },
];

describe('toCompsetEntries', () => {
  it('prices the watchlist hotels Google Hotels actually carries', () => {
    const { entries } = toCompsetEntries(PROPERTIES, COMPSET, { excludeToken: OURS.property_token });

    expect(entries).toEqual([
      { name: 'Rivermark Lodge Harbor Road', price: 66 },
      { name: 'Tidewater Inn & Suites by Harborline Kestrel Bay', price: 66 },
      { name: 'Gull Point Motor Inn Kestrel Bay', price: 70 },
      { name: 'Cormorant Court Kestrel Bay Area', price: 62 },
      { name: 'Lantern Bay Suites Kestrel Bay by Harborline', price: 100 },
      { name: 'Pinecrest Inn Kestrel Bay Area', price: 65 },
      { name: 'The Anchorage Hotel Kestrel Bay by Harborline', price: 88 },
      { name: 'Nyx by Wavecrest Kestrel Bay Harbor', price: 140 },
    ]);
  });

  it('names the watchlist hotels that are absent, so a gap is not silent', () => {
    const { notFound } = toCompsetEntries(PROPERTIES, COMPSET, { excludeToken: OURS.property_token });
    expect(notFound).toEqual(['Beacon Rest', 'Dockside Motel']);
  });

  it('never counts our own property as a competitor', () => {
    const { entries } = toCompsetEntries(PROPERTIES, { ...COMPSET, competitors: ['Harbor Pine'] }, {
      excludeToken: OURS.property_token,
    });
    expect(entries).toEqual([]);
  });

  it('returns the resolved tokens so later runs can match exactly', () => {
    const { resolvedTokens } = toCompsetEntries(PROPERTIES, COMPSET, { excludeToken: OURS.property_token });

    expect(resolvedTokens['Cormorant Court']).toBe(
      PROPERTIES.find((p) => p.name === 'Cormorant Court Kestrel Bay Area')!.property_token
    );
    expect(resolvedTokens['Beacon Rest']).toBeUndefined();
  });

  it('matches on a known token even when the listed name has drifted', () => {
    // Renamed past all recognition — only the token can still find it.
    const renamed = PROPERTIES.map((p) =>
      p.name === 'Cormorant Court Kestrel Bay Area' ? { ...p, name: 'Mill Creek Lodge' } : p
    );
    const token = PROPERTIES.find((p) => /Cormorant/.test(p.name!))!.property_token!;

    const byName = toCompsetEntries(renamed, { ...COMPSET, competitors: ['Cormorant Court'] }, {
      excludeToken: OURS.property_token,
    });
    expect(byName.entries).toEqual([]);

    const byToken = toCompsetEntries(renamed, { ...COMPSET, competitors: ['Cormorant Court'] }, {
      excludeToken: OURS.property_token,
      knownTokens: { 'Cormorant Court': token },
    });
    expect(byToken.entries).toEqual([{ name: 'Mill Creek Lodge', price: 62 }]);
  });

  it('drops prices outside the sanity bounds', () => {
    const { entries } = toCompsetEntries(PROPERTIES, { ...COMPSET, priceSanity: { min: 40, max: 90 } }, {
      excludeToken: OURS.property_token,
    });
    expect(entries.map((e) => e.price).every((p) => p <= 90)).toBe(true);
    expect(entries.some((e) => e.name.startsWith('Nyx by Wavecrest'))).toBe(false);
  });

  it('reports a property with no rate as unavailable rather than missing', () => {
    const soldOut = [{ name: 'Pinecrest Inn Kestrel Bay Area', property_token: 'tok' }];
    const { entries, unavailable } = toCompsetEntries(soldOut, COMPSET, {});

    expect(entries).toEqual([]);
    expect(unavailable).toEqual(['Pinecrest Inn Kestrel Bay Area']);
  });

  it('treats a hotel we have priced before but cannot see tonight as sold out, not missing', () => {
    // Sold-out properties sometimes vanish from results entirely rather than
    // appearing without a rate. A token we resolved on an earlier run is proof
    // Google does carry the hotel, so absence means no inventory — not no listing.
    const withoutPinecrest = PROPERTIES.filter((p) => !/Pinecrest Inn/.test(p.name ?? ''));
    const knownToken = PROPERTIES.find((p) => /Pinecrest Inn/.test(p.name!))!.property_token!;

    const { notFound, unavailable } = toCompsetEntries(withoutPinecrest, COMPSET, {
      excludeToken: OURS.property_token,
      knownTokens: { 'Pinecrest Inn': knownToken },
    });

    expect(unavailable).toContain('Pinecrest Inn');
    expect(notFound).not.toContain('Pinecrest Inn');
    // Beacon Rest and Dockside Motel have never resolved a token — genuinely not carried.
    expect(notFound).toEqual(['Beacon Rest', 'Dockside Motel']);
  });
});

describe('toParityChecks', () => {
  const checks = toParityChecks(DETAIL, TIER_MAP, '2026-08-23T00:00:00Z');

  it('marks our own listing as the official channel', () => {
    const official = checks.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0].source).toBe('Harbor Pine Inn');
    expect(official[0].price).toBe(80);
  });

  it('keeps every third-party channel, not just the four we used to scrape', () => {
    expect(checks).toHaveLength(26);
    const sources = checks.map((c) => c.source);
    expect(sources).toContain('Booking.com');
    expect(sources).toContain('Expedia.com');
    expect(sources).toContain('Super.com');
  });

  it('exposes the undercut that matters — someone selling below our direct rate', () => {
    const official = checks.find((c) => c.official)!.price!;
    const cheapest = checks.filter((c) => !c.official).sort((a, b) => a.price! - b.price!)[0];

    expect(cheapest.source).toBe('Super.com');
    expect(cheapest.price).toBe(62);
    expect(cheapest.price!).toBeLessThan(official);
  });

  it('attaches the tier-mapped room breakdown to the official check', () => {
    const official = checks.find((c) => c.official)!;
    expect(official.rooms).toBeDefined();
    expect(official.rooms!.some((r) => r.tierId === 'superior')).toBe(true);
    expect(official.rooms!.some((r) => r.tierId === 'standard')).toBe(true);
  });

  it('returns nothing rather than guessing when the response carries no prices', () => {
    expect(toParityChecks({ name: 'x' }, TIER_MAP, '2026-08-23T00:00:00Z')).toEqual([]);
  });
});

describe('toRoomRates', () => {
  const rooms = toRoomRates(DETAIL, TIER_MAP);

  it('maps superior rooms to the superior tier and the rest to standard', () => {
    const superior = rooms.filter((r) => r.tierId === 'superior');
    const standard = rooms.filter((r) => r.tierId === 'standard');

    expect(superior.length).toBeGreaterThan(0);
    expect(standard.length).toBeGreaterThan(0);
    expect(superior.every((r) => /superior/i.test(r.room))).toBe(true);
  });

  it('takes the lowest rate for a room seen on more than one channel', () => {
    // "Superior Room, 1 King Bed, Non Smoking" is $87 on Expedia and $89 on Hotels.com.
    const room = rooms.find((r) => r.room === 'Superior Room, 1 King Bed, Non Smoking');
    expect(room?.price).toBe(87);
  });

  it('trims the stray whitespace SerpApi leaves on some room names', () => {
    expect(rooms.every((r) => r.room === r.room.trim())).toBe(true);
    expect(rooms.some((r) => r.room === 'Deluxe Room with Two Queen Beds Non-Smoking')).toBe(true);
  });

  it('gives the cheapest standard room, which is what the overview reads', () => {
    const cheapestStandard = Math.min(...rooms.filter((r) => r.tierId === 'standard').map((r) => r.price));
    expect(cheapestStandard).toBe(81);
  });
});
