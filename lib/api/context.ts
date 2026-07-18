import { getStore } from '../store';
import type { Store } from '../store';
import type { Snapshot } from '../scoring/types';
import { DEFAULT_PROPERTY_ID, getProperty, propKey, type Property } from '../properties';
import { authenticate, canReadProperty, apiError, type ApiKeyRecord } from './auth';

/** Scoped snapshot with legacy-key fallback for the original property. */
export async function loadPropertySnapshot(store: Store, propertyId: string): Promise<Snapshot | null> {
  const scoped = await store.get<Snapshot>(propKey.snapshotLatest(propertyId));
  if (scoped) return scoped;
  if (propertyId === DEFAULT_PROPERTY_ID) return store.get<Snapshot>('snapshot:latest');
  return null;
}

export interface PropertyContext {
  store: Store;
  record: ApiKeyRecord;
  property: Property;
  snapshot: Snapshot;
  /** Minutes since the collector produced this snapshot. */
  ageMinutes: number;
}

/**
 * Auth → property authorization → snapshot load, shared by every per-property
 * endpoint. Returns a Response on any failure so handlers can early-return it.
 */
export async function propertyContext(req: Request, propertyId: string): Promise<PropertyContext | Response> {
  const store = getStore();
  const auth = await authenticate(req, store);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const property = getProperty(propertyId);
  if (!property) return apiError(404, 'unknown_property', `No property "${propertyId}".`);
  if (!canReadProperty(auth.record, propertyId)) {
    return apiError(403, 'forbidden', 'This API key cannot read that property.');
  }

  const snapshot = await loadPropertySnapshot(store, propertyId);
  if (!snapshot) return apiError(404, 'no_data', 'No collector data for this property yet.');

  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  return { store, record: auth.record, property, snapshot, ageMinutes };
}

/** The provenance block every response carries — accuracy claims live here, not in prose. */
export function provenance(ctx: PropertyContext) {
  return {
    propertyId: ctx.property.id,
    runAt: ctx.snapshot.runAt,
    ageMinutes: ctx.ageMinutes,
    confidence: ctx.snapshot.confidence,
    confidenceNote: ctx.snapshot.confidenceNote,
    sources: ctx.snapshot.sources.map((s) => ({ source: s.source, status: s.status, fetchedAt: s.fetchedAt })),
  };
}
