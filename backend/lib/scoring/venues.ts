import type { RawEvent } from './types';

/** Known venue capacities (lowercase key matching). */
export const VENUE_CAPACITY: Record<string, number> = {
  'nissan stadium': 69000,
  'geodis park': 30000,
  'bridgestone arena': 17100,
  'firstbank stadium': 34000,
  'music city center': 5000,
};

/** First table entry whose key appears in the venue name (lowercase substring). */
function lookup<T>(table: Record<string, T>, venue: string): T | null {
  const key = venue.trim().toLowerCase();
  return Object.entries(table).find(([name]) => key.includes(name))?.[1] ?? null;
}

export function venueCapacity(venue: string): number | null {
  return lookup(VENUE_CAPACITY, venue);
}

/**
 * Approximate coordinates for the venues we track, so Market Intelligence can
 * place events on a map and compute distance from the property. Same precision
 * as the property's own pin in lib/properties.ts — good to a block or so, which
 * is all a "how far is this event" read needs.
 *
 * An event at a venue not listed here gets no pin and no distance rather than
 * a guessed one; the map caption says how many were placed.
 */
export const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  'nissan stadium': { lat: 36.1665, lng: -86.7713 },
  'geodis park': { lat: 36.1305, lng: -86.7656 },
  'bridgestone arena': { lat: 36.1593, lng: -86.7785 },
  'firstbank stadium': { lat: 36.1447, lng: -86.8089 },
  'music city center': { lat: 36.1567, lng: -86.7757 },
};

export function venueCoords(venue: string): { lat: number; lng: number } | null {
  return lookup(VENUE_COORDS, venue);
}

/**
 * Travel-draw multiplier: how much of this event's audience travels from out of
 * town and needs a bed — vs. locals driving home the same night.
 */
export function travelDraw(e: RawEvent): number {
  const cap = e.capacity ?? venueCapacity(e.venue) ?? 0;

  if (e.kind === 'university') return 1.4; // graduation / move-in / parents weekend: out-of-town families by definition
  if (e.kind === 'holiday') return 1.0; // profile handled via expectedAttendance
  if (cap > 0 && cap < 2500) return 0.3; // clubs/theaters: local audience, drives home

  if (e.kind === 'concert' && e.isTouring) {
    return cap >= 40000 ? 1.5 : 1.2; // stadium tour vs arena tour
  }
  if (e.kind === 'convention') {
    return (e.expectedAttendance ?? 0) >= 8000 ? 1.3 : 0.8; // big conventions fly in; small ones are regional
  }
  if (e.kind === 'sports') {
    return e.venue.toLowerCase().includes('firstbank') ? 1.0 : 0.6; // college football brings visiting fans; NHL/MLS regular season is local
  }
  return 0.5; // unknown: conservative middle-low
}
