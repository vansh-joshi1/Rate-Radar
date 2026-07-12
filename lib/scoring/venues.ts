import type { RawEvent } from './types';

/** Known venue capacities (lowercase key matching). */
export const VENUE_CAPACITY: Record<string, number> = {
  'nissan stadium': 69000,
  'geodis park': 30000,
  'bridgestone arena': 17100,
  'firstbank stadium': 34000,
  'music city center': 5000,
};

export function venueCapacity(venue: string): number | null {
  const key = venue.trim().toLowerCase();
  for (const [name, cap] of Object.entries(VENUE_CAPACITY)) {
    if (key.includes(name)) return cap;
  }
  return null;
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
