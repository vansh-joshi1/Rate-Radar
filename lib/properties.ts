/**
 * Property registry — the multi-hotel foundation.
 *
 * Every stored artifact is scoped by property id (`prop:{id}:...`); adding a
 * hotel is one entry here plus a collector run that tags its bundle with the
 * same `propertyId`. The legacy unscoped keys (`snapshot:latest`) are still
 * dual-written for the existing dashboard and default to DEFAULT_PROPERTY_ID.
 */

export interface Property {
  id: string;
  name: string;
  city: string;
  timezone: string;
  /** Approximate coordinates — map centering and the property's own pin. */
  lat: number;
  lng: number;
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
};

export function getProperty(id: string): Property | undefined {
  if (id === DEMO_PROPERTY.id) return DEMO_PROPERTY;
  return PROPERTIES.find((p) => p.id === id);
}

/** Storage key helpers — single source of truth for the scoped layout. */
export const propKey = {
  snapshotLatest: (id: string) => `prop:${id}:snapshot:latest`,
  snapshotRun: (id: string, date: string, runId: string) => `prop:${id}:snapshot:${date}:${runId}`,
};
