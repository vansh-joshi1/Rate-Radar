import propertiesConfig from '../config/properties.json';
import defaultCompset from '../config/compset.json';
import type { CompsetConfig } from '../lib/scoring/compset';
import type { Property } from '../lib/properties';
import { OPEN_PRICE_SANITY } from '../lib/watchlist';

/**
 * Collection config per property — resolved from config/properties.json.
 * "env:VAR" strings are looked up in the environment at load time so listing
 * URLs can live in GitHub secrets exactly as they always have.
 */

/** Maps scraped room names to pricing tiers: first substring match wins, '*' is the catch-all. */
export interface RoomTierRule {
  match: string;
  tierId: string;
}

export function mapRoomToTier(room: string, rules: RoomTierRule[]): string | undefined {
  const lower = room.toLowerCase();
  for (const r of rules) {
    if (r.match === '*' || lower.includes(r.match.toLowerCase())) return r.tierId;
  }
  return undefined;
}

export interface SerpApiPropertyConfig {
  /** Location query for the compset search — 'hotels near <address>' works best. */
  query: string;
  /** Our own property's google_hotels property_token; stable, resolved once. */
  propertyToken?: string;
}

export interface RatePropertyConfig {
  id: string;
  name: string;
  serpapi?: SerpApiPropertyConfig;
  compset: CompsetConfig;
  roomTierMap: RoomTierRule[];
  /** Property-local timezone; the horizon starts at its tonight. */
  timezone?: string;
  market: Market;
  /** Live watchlist (name + resolved property token) fetched from the dashboard at run start. */
  watchlistHotels?: { name: string; propertyToken?: string }[];
}

function resolve(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith('env:') ? process.env[value.slice(4)] : value;
}

interface RawProperty {
  id: string;
  name: string;
  serpapi?: { query: string; propertyToken?: string };
  compset: CompsetConfig | null;
  roomTierMap?: RoomTierRule[];
}

export function loadProperties(): RatePropertyConfig[] {
  const raw = (propertiesConfig as { properties: RawProperty[] }).properties;
  return raw.map((p) => {
    const query = resolve(p.serpapi?.query);
    return {
      id: p.id,
      name: p.name,
      ...(query ? { serpapi: { query, propertyToken: resolve(p.serpapi?.propertyToken) } } : {}),
      compset: p.compset ?? (defaultCompset as CompsetConfig),
      roomTierMap: p.roomTierMap ?? [],
      market: { kind: 'nashville' as const },
    };
  });
}

/**
 * Where a hotel's demand signals come from. The original property has the
 * Nashville sources, built for its venues, counties and airport. Everyone else
 * gets the ones that work from coordinates alone: Ticketmaster within a radius,
 * NWS alerts for the exact point, and FAA status for the airport set at approval.
 */
export type Market = { kind: 'nashville' } | { kind: 'local'; lat: number; lng: number; airport?: string };

/** Collection config for a hotel approved from onboarding (stored in the dashboard, not this file). */
export function fromStoredProperty(p: Property & { collect: NonNullable<Property['collect']> }): RatePropertyConfig {
  return {
    id: p.id,
    name: p.name,
    timezone: p.timezone,
    serpapi: { query: p.collect.serpQuery, propertyToken: p.collect.propertyToken },
    // Competitors come from the hotel's own watchlist, fetched at run start. Never
    // the config file's: that list is Franklin's rivals.
    compset: { competitors: [], priceSanity: OPEN_PRICE_SANITY },
    roomTierMap: [
      ...p.collect.superiorRooms.map((match) => ({ match, tierId: 'superior' })),
      { match: '*', tierId: 'standard' },
    ],
    market: { kind: 'local', lat: p.lat, lng: p.lng, airport: p.collect.airport },
  };
}
