import type { Store } from './store';
import type { RunTelemetry } from '../collector/telemetry';

/**
 * Rolling window of collection telemetry, newest first.
 *
 * Bounded deliberately: this is diagnostic data on a free Upstash tier, and
 * an unbounded list would grow forever for no benefit. 100 runs is ~25 days
 * at 4 runs/day — long enough to compare a baseline against a change.
 *
 * Stored as one JSON array via set() rather than lpush/lrange so the bound is
 * enforced on write in a single round trip, and so FileStore and Upstash
 * behave identically.
 */

export const TELEMETRY_WINDOW = 100;

export const collectionTelemetryKey = (propertyId: string) => `prop:${propertyId}:collection-telemetry`;

export async function loadRunTelemetry(store: Store, propertyId: string): Promise<RunTelemetry[]> {
  return (await store.get<RunTelemetry[]>(collectionTelemetryKey(propertyId))) ?? [];
}

export async function appendRunTelemetry(store: Store, propertyId: string, run: RunTelemetry): Promise<void> {
  const existing = await loadRunTelemetry(store, propertyId);
  const next = [run, ...existing].slice(0, TELEMETRY_WINDOW);
  await store.set(collectionTelemetryKey(propertyId), next);
}
