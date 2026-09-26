/**
 * Property registry — the multi-hotel foundation.
 *
 * The original property is built in below. Every other hotel is approved at
 * /admin and stored (`addProperty`); the collector fetches that list each run.
 * Each hotel's data lives in its own store (`storeFor` in lib/store.ts): the
 * original under the unprefixed keys it always had, the rest under
 * `tenant:{id}:`, so the same keys (`snapshot:latest`, `bookings`, …) never mix.
 */

import type { Store } from './store';

export interface Property {
  id: string;
  name: string;
  city: string;
  timezone: string;
  /** Approximate coordinates — map centering and the property's own pin. */
  lat: number;
  lng: number;
  /** Rooms the property sells — the ceiling for a rooms-booked reading. */
  totalRooms: number;
  /**
   * Collection settings for a hotel added through onboarding. Franklin keeps
   * its own in config/properties.json and its Nashville-specific sources.
   */
  collect?: {
    /** SerpApi compset search, 'hotels near <address>'. */
    serpQuery: string;
    /** Our own google_hotels property_token, when onboarding matched one. */
    propertyToken?: string;
    /** FAA code of the nearest commercial airport, for delay alerts. */
    airport?: string;
    /** Room names the hotel called Superior at onboarding; the rest are Standard. */
    superiorRooms: string[];
  };
}

export const DEFAULT_PROPERTY_ID = 'rri-franklin';

export const PROPERTIES: Property[] = [
  {
    id: 'rri-franklin',
    name: 'Red Roof Inn Franklin',
    city: 'Franklin, TN',
    timezone: 'America/Chicago',
    // 3915 Carothers Pkwy, Franklin TN (Cool Springs) — approximate
    lat: 35.9273,
    lng: -86.8149,
    totalRooms: 55,
  },
];

/**
 * The invented property the public demo prices. Deliberately NOT in
 * `PROPERTIES`: it is not a hotel anyone collects for and it has no business
 * appearing in the v1 API's property listing. It is resolvable by id, though,
 * because the same route handlers serve demo sandboxes and check that the
 * property they were asked about exists.
 *
 * Kestrel Bay is not a place, and Harbor Pine Inn is not a hotel. See lib/demo.ts
 * for why the demo world is invented down to the last name.
 */
export const DEMO_PROPERTY: Property = {
  id: 'demo-harbor-pine',
  name: 'Harbor Pine Inn',
  city: 'Kestrel Bay, OR',
  timezone: 'America/Los_Angeles',
  lat: 44.6285,
  lng: -124.0538,
  totalRooms: 48,
};

/** Built-in properties only (Franklin + the demo). Stored hotels need `loadProperty`. */
export function getProperty(id: string): Property | undefined {
  if (id === DEMO_PROPERTY.id) return DEMO_PROPERTY;
  return PROPERTIES.find((p) => p.id === id);
}

/**
 * Hotels approved from onboarding, kept in the store so approving one needs no
 * deploy. Unprefixed, global: the list itself is not any one hotel's data.
 */
export const PROPERTIES_KEY = 'properties';

/** Built-in first, then every approved hotel. */
export async function listProperties(store: Store): Promise<Property[]> {
  return [...PROPERTIES, ...((await store.get<Property[]>(PROPERTIES_KEY)) ?? [])];
}

export async function loadProperty(store: Store, id: string): Promise<Property | undefined> {
  return getProperty(id) ?? (await store.get<Property[]>(PROPERTIES_KEY))?.find((p) => p.id === id);
}

export async function addProperty(store: Store, property: Property): Promise<void> {
  // ponytail: read-modify-write; two approvals in the same instant can drop one.
  const stored = (await store.get<Property[]>(PROPERTIES_KEY)) ?? [];
  await store.set(PROPERTIES_KEY, [...stored, property]);
}

/** A url-safe id from the hotel name that no existing property uses. */
export function newPropertyId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hotel';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Storage key helpers — single source of truth for the scoped layout. */
export const propKey = {
  snapshotLatest: (id: string) => `prop:${id}:snapshot:latest`,
  snapshotRun: (id: string, date: string, runId: string) => `prop:${id}:snapshot:${date}:${runId}`,
  /** Raw collected bundle, replayed by /api/recompute when config changes. */
  bundleLatest: (id: string) => `prop:${id}:bundle:latest`,
};
