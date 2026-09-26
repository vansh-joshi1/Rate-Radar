import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, prefixed } from '../lib/store';
import { membershipFor, saveMembers } from '../lib/auth/members';
import { addProperty, listProperties, loadProperty, newPropertyId, DEFAULT_PROPERTY_ID, type Property } from '../lib/properties';
import { baselineFromRooms, DEFAULT_RATES_CONFIG } from '../lib/rates-config';
import { confidence } from '../lib/scoring/recommend';
import { expectedSources } from '../lib/ingest';
import { fromStoredProperty, mapRoomToTier } from '../collector/properties';
import type { SourceResult } from '../lib/scoring/types';

const freshStore = () => new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-mp-')), 'store.json'));

const HOTEL: Property = {
  id: 'maple-lodge',
  name: 'Maple Lodge',
  city: 'Asheville, NC',
  timezone: 'America/New_York',
  lat: 35.59,
  lng: -82.55,
  totalRooms: 40,
  collect: { serpQuery: 'hotels near 1 Main St, Asheville, NC', airport: 'AVL', superiorRooms: ['King Suite'] },
};

// The request → property seam, with the session faked: who is asking decides the property.
const session = { property: HOTEL as Property };
vi.mock('../lib/demo/context', () => ({
  demoSid: () => null,
  requestProperty: async () => session.property,
  requestStore: async () => freshStore(),
}));

describe('which property a dashboard request may touch', () => {
  beforeEach(() => {
    session.property = HOTEL;
    process.env.INGEST_SECRET = 'secret';
  });

  it("a member gets their own hotel and is refused another's by query string", async () => {
    const { propertyFromRequest } = await import('../lib/api/property-request');
    const own = await propertyFromRequest(new Request('https://x/api/watchlist'));
    expect(own.ok && own.propertyId).toBe('maple-lodge');

    const same = await propertyFromRequest(new Request('https://x/api/watchlist?propertyId=maple-lodge'));
    expect(same.ok).toBe(true);

    const other = await propertyFromRequest(new Request(`https://x/api/watchlist?propertyId=${DEFAULT_PROPERTY_ID}`));
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.response.status).toBe(403);
  });

  it('only the collector secret may name a property, and only a real one', async () => {
    const { propertyFromRequest } = await import('../lib/api/property-request');
    const auth = { headers: { authorization: 'Bearer secret' } };
    const franklin = await propertyFromRequest(new Request(`https://x/api/watchlist?propertyId=${DEFAULT_PROPERTY_ID}`, auth));
    expect(franklin.ok && franklin.propertyId).toBe(DEFAULT_PROPERTY_ID);

    const wrongSecret = await propertyFromRequest(
      new Request(`https://x/api/watchlist?propertyId=${DEFAULT_PROPERTY_ID}`, { headers: { authorization: 'Bearer nope' } })
    );
    expect(wrongSecret.ok).toBe(false);
  });
});

describe('membership', () => {
  it('members carry their hotel; members from before hotels were separated belong to the original one', async () => {
    const store = freshStore();
    await saveMembers(store, [
      { email: 'old@rri.com', role: 'manager', invitedAt: 'x' },
      { email: 'gm@maple.com', role: 'owner', invitedAt: 'x', propertyId: 'maple-lodge' },
    ]);
    expect(await membershipFor(store, 'old@rri.com')).toEqual({ role: 'manager', propertyId: DEFAULT_PROPERTY_ID });
    expect(await membershipFor(store, 'GM@maple.com')).toEqual({ role: 'owner', propertyId: 'maple-lodge' });
    expect(await membershipFor(store, 'nobody@x.com')).toBeNull();
  });
});

describe('property registry', () => {
  it('stored hotels resolve next to the built-in one, and ids never collide', async () => {
    const store = freshStore();
    await addProperty(store, HOTEL);
    expect((await listProperties(store)).map((p) => p.id)).toEqual([DEFAULT_PROPERTY_ID, 'maple-lodge']);
    expect((await loadProperty(store, 'maple-lodge'))?.city).toBe('Asheville, NC');
    expect(await loadProperty(store, 'nope')).toBeUndefined();
    expect(newPropertyId('Maple Lodge!', ['maple-lodge', 'maple-lodge-2'])).toBe('maple-lodge-3');
  });

  it("a tenant prefix keeps one hotel's keys out of another's", async () => {
    const base = freshStore();
    await prefixed(base, 'tenant:maple-lodge:').set('snapshot:latest', { who: 'maple' });
    expect(await base.get('snapshot:latest')).toBeNull();
    await base.hset('onboarding:requests', 'a@b.com', { n: 1 });
    expect(await base.hgetall('onboarding:requests')).toEqual({ 'a@b.com': { n: 1 } });
  });
});

describe('seeding a new hotel', () => {
  it('baselines come from its own observed prices, not the original hotel', () => {
    const cfg = baselineFromRooms([
      { tier: 'standard', price: 180 },
      { tier: 'standard', price: 200 },
      { tier: 'superior', price: 260 },
    ]);
    expect(cfg.tiers[0]).toMatchObject({ id: 'standard', weekday: { min: 162, max: 180 }, weekend: { min: 180, max: 207 } });
    expect(cfg.tiers[1].weekday).toEqual({ min: 234, max: 260 });
    // one tier priced: the other is derived, not left at Franklin's numbers
    expect(baselineFromRooms([{ tier: 'standard', price: 100 }]).tiers[1].weekday.max).toBe(115);
    expect(baselineFromRooms([{ tier: 'standard', price: null }])).toBe(DEFAULT_RATES_CONFIG);
  });

  it("the collector prices it with its own competitors and room names, never Franklin's", () => {
    const cfg = fromStoredProperty(HOTEL as Property & { collect: NonNullable<Property['collect']> });
    expect(cfg.compset.competitors).toEqual([]);
    expect(cfg.market).toEqual({ kind: 'local', lat: 35.59, lng: -82.55, airport: 'AVL' });
    expect(mapRoomToTier('Deluxe King Suite', cfg.roomTierMap)).toBe('superior');
    expect(mapRoomToTier('2 Queen Beds', cfg.roomTierMap)).toBe('standard');
  });
});

describe('confidence by market', () => {
  const ok = (source: string): SourceResult => ({ source, status: 'ok', fetchedAt: 'x' });

  it("a hotel outside Nashville is not docked for Nashville's sources", () => {
    const expected = expectedSources(HOTEL)!;
    expect(expected.sort()).toEqual(['faa', 'holidays', 'nws', 'rates', 'ticketmaster']);
    expect(confidence(expected.map(ok), expected).value).toBe(100);
    const noAirport = expectedSources({ ...HOTEL, collect: { ...HOTEL.collect!, airport: undefined } })!;
    expect(noAirport).not.toContain('faa');
  });

  it('the original property still expects every source', () => {
    const { collect: _, ...franklinLike } = HOTEL;
    expect(expectedSources(franklinLike)).toBeUndefined();
    expect(confidence([ok('rates')]).value).toBe(30);
  });
});
