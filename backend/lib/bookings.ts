import type { Store } from './store';
import type { Property } from './properties';
import { todayIn } from './date';

/**
 * Rooms on the books for a night, as someone at the hotel reported it.
 *
 * Readings append rather than overwrite: the latest one is the night's figure,
 * and the earlier ones are booking pace — how the night filled over the day.
 * That pairing with the rate charged is the data a future demand forecast needs.
 */
export interface BookingReading {
  rooms: number;
  at: string;
}

export type Bookings = Record<string, BookingReading[]>;

/** Unscoped, like `actuals` beside it; `requestStore()` namespaces it for the demo. */
export const BOOKINGS_KEY = 'bookings';

export type RecordResult =
  | { ok: true; date: string; reading: BookingReading }
  | { ok: false; error: string };

/**
 * Record tonight's rooms-booked count. The date is always tonight in the
 * property's timezone, decided here rather than by the caller, so nobody can
 * back-fill or pre-fill a night by posting a different date.
 */
export async function recordTonight(
  store: Store,
  property: Property,
  rooms: number,
  now: Date = new Date()
): Promise<RecordResult> {
  if (!Number.isInteger(rooms) || rooms < 0 || rooms > property.totalRooms) {
    return { ok: false, error: `Enter a whole number from 0 to ${property.totalRooms}.` };
  }
  const date = todayIn(property.timezone, now);
  const reading = { rooms, at: now.toISOString() };
  // ponytail: read-modify-write, same as `actuals`; two saves in the same instant can drop one.
  const bookings = (await store.get<Bookings>(BOOKINGS_KEY)) ?? {};
  (bookings[date] ??= []).push(reading);
  await store.set(BOOKINGS_KEY, bookings);
  return { ok: true, date, reading };
}
