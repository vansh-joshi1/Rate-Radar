import type { SerpProperty, SerpPropertyDetails } from '../collector/sources/serpapi';
import { haversineMiles } from './geo';

/**
 * Pure pieces of onboarding discovery (app/api/onboarding/discover), kept here
 * so they test without SerpApi.
 */

export type RoomTier = 'standard' | 'superior';

export interface Candidate {
  name: string;
  token: string;
  lat: number;
  lng: number;
}

export interface Nearby {
  name: string;
  distanceMi: number;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** Words nearly every hotel name shares. Matching on them made every "___ Inn Franklin" look like a hit. */
const GENERIC = new Set(
  'the a an and of at by in on hotel hotels inn inns suites suite motel motor lodge resort extended stay express plus'.split(' '),
);

/**
 * The words that tell this hotel apart: its name minus generic words and minus
 * anything also in the address (the city, the street). "Red Roof Inn Franklin"
 * at a Franklin address comes down to "red roof". If nothing distinctive is
 * left (a "Franklin Inn" in Franklin), fall back to the non-generic words.
 */
function distinctive(name: string, address: string): Set<string> {
  const place = words(address);
  const core = [...words(name)].filter((w) => !GENERIC.has(w));
  const brand = core.filter((w) => !place.has(w));
  return new Set(brand.length ? brand : core);
}

/** Share of the distinctive words found in a result's name. 0..1. */
function nameScore(want: Set<string>, found: string): number {
  if (want.size === 0) return 0;
  const have = words(found);
  let hit = 0;
  for (const w of want) if (have.has(w)) hit++;
  return hit / want.size;
}

function toCandidate(p: SerpProperty): Candidate | null {
  if (!p.name || !p.property_token || !p.gps_coordinates) return null;
  return { name: p.name, token: p.property_token, lat: p.gps_coordinates.latitude, lng: p.gps_coordinates.longitude };
}

/**
 * "Is this you?": results sharing at least half the name's distinctive words,
 * best first, one per property. Nothing close enough means an empty list, and
 * the page falls back to manual entry rather than offering a stranger.
 */
export function rankCandidates(typedName: string, address: string, results: SerpProperty[], limit = 3): Candidate[] {
  const want = distinctive(typedName, address);
  const seen = new Set<string>();
  return allCandidates(results)
    .filter((c) => !seen.has(c.token) && seen.add(c.token))
    .map((c) => ({ c, s: nameScore(want, c.name) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Every usable result, trimmed to what the client needs. */
export function allCandidates(results: SerpProperty[]): Candidate[] {
  return results.map(toCandidate).filter((c): c is Candidate => c !== null);
}

/** Comp set suggestions: the closest other hotels to the confirmed property. */
export function nearbyHotels(self: Candidate, hotels: Candidate[], limit = 8): Nearby[] {
  const seen = new Set([self.token]);
  return hotels
    .filter((c) => !seen.has(c.token) && seen.add(c.token))
    .map((c) => ({ name: c.name, distanceMi: Math.round(haversineMiles(self.lat, self.lng, c.lat, c.lng) * 10) / 10 }))
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, limit);
}

/** Channels selling the property. The direct listing is flagged `official`, never matched by name. */
export function channelsOf(details: SerpPropertyDetails): { source: string; official: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const p of [...(details.featured_prices ?? []), ...(details.prices ?? [])]) {
    if (!p.source) continue;
    seen.set(p.source, (seen.get(p.source) ?? false) || p.official === true);
  }
  return [...seen].map(([source, official]) => ({ source, official })).sort((a, b) => Number(b.official) - Number(a.official));
}

/** One room type, however many channels list it and under whatever names. */
export interface RoomType {
  name: string;
  /** Cheapest nightly rate seen for it, when a channel priced it. */
  price: number | null;
}

const NUMBERS: Record<string, string> = { one: '1', two: '2', three: '3', single: '1', double: '2' };

/**
 * Words that change the listing, not the room: every channel phrases the same
 * room its own way ("King Room", "1 King Bed", "King Room - Non-Smoking").
 * "Standard"-type words are here too, so "Standard King" joins "King Room".
 */
const ROOM_NOISE = new Set(
  'room rooms bed beds non smoking nonsmoking with and guest 1 mobility accessible hearing roll in shower tub standard classic basic regular'.split(' '),
);

/** Grouping key: "2 Queen Beds Non-Smoking" and "Two Queen Room" both become "2 queen". */
export function roomKey(name: string): string {
  const tokens = (name.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((w) => NUMBERS[w] ?? w)
    .filter((w) => !ROOM_NOISE.has(w));
  return [...new Set(tokens)].sort().join(' ') || name.toLowerCase().trim();
}

/** Room types across every channel, near-duplicates merged under the shortest name. */
export function roomsOf(details: SerpPropertyDetails): RoomType[] {
  const groups = new Map<string, RoomType>();
  for (const p of [...(details.featured_prices ?? []), ...(details.prices ?? [])])
    for (const r of p.rooms ?? []) {
      const name = r.name?.trim();
      if (!name) continue;
      const key = roomKey(name);
      const price = r.rate_per_night?.extracted_lowest ?? null;
      const g = groups.get(key);
      if (!g) groups.set(key, { name, price });
      else {
        if (name.length < g.name.length) g.name = name;
        if (price !== null && (g.price === null || price < g.price)) g.price = price;
      }
    }
  return [...groups.values()];
}

/** How far up a hotel's own ladder a name sits. Only the order matters, never the word. */
const LADDER: RegExp[] = [
  /\b(suite|penthouse|presidential|villa|apartment)\b/i,
  /\b(deluxe|superior|premium|premier|executive|business|club|signature|luxury|grand|jacuzzi|whirlpool|spa)\b/i,
];
function level(name: string): number {
  const i = LADDER.findIndex((re) => re.test(name));
  return i < 0 ? 0 : LADDER.length - i;
}

/** Prices this close together are one tier: $95 and $99 are the same room to a guest. */
const SAME_TIER_RATIO = 1.1;

/**
 * Standard or Superior, relative to this hotel's own rooms, because hotels
 * name their levels differently. Price leads when channels priced at least
 * two types: the rooms above the widest gap in this hotel's rates are
 * Superior. Otherwise the name's position on the ladder decides, and the
 * hotel's lowest level is Standard whatever it is called, so a hotel whose
 * cheapest rooms are "Deluxe" does not get every room marked Superior.
 */
export function assignTiers(rooms: RoomType[]): (RoomType & { tier: RoomTier })[] {
  const prices = [...new Set(rooms.map((r) => r.price).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  let cut = Infinity;
  if (prices.length >= 2 && prices[prices.length - 1] / prices[0] >= SAME_TIER_RATIO) {
    let widest = 0;
    for (let i = 1; i < prices.length; i++) {
      const gap = prices[i] / prices[i - 1];
      if (gap > widest) [widest, cut] = [gap, prices[i]];
    }
  }
  const floor = Math.min(...rooms.map((r) => level(r.name)));
  return rooms.map((r) => ({
    ...r,
    tier: (r.price !== null && cut !== Infinity ? r.price >= cut : level(r.name) > floor) ? 'superior' : 'standard',
  }));
}
