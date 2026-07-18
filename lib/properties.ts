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
}

export const DEFAULT_PROPERTY_ID = 'rri-franklin';

export const PROPERTIES: Property[] = [
  { id: 'rri-franklin', name: 'Red Roof Inn Franklin', city: 'Franklin, TN', timezone: 'America/Chicago' },
];

export function getProperty(id: string): Property | undefined {
  return PROPERTIES.find((p) => p.id === id);
}

/** Storage key helpers — single source of truth for the scoped layout. */
export const propKey = {
  snapshotLatest: (id: string) => `prop:${id}:snapshot:latest`,
  snapshotRun: (id: string, date: string, runId: string) => `prop:${id}:snapshot:${date}:${runId}`,
};
