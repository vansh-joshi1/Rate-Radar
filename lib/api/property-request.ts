import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_PROPERTY_ID, getProperty, type Property } from '../properties';

/**
 * `?propertyId=` → a real property, or the 404 to early-return.
 *
 * Five dashboard routes opened with the same two lines — read the param,
 * default it, 404 on an unknown id — written out eight times between them,
 * which is eight chances for one of them to answer differently.
 *
 * Deliberately NOT part of `lib/api/context.ts`: that module serves the
 * versioned public API, which authenticates by key and answers in a
 * `{ error: { code, message } }` envelope. These routes answer the dashboard's
 * own session-authenticated callers in a flat `{ error }` shape. Sharing one
 * helper across both would have to change one of those contracts.
 */
export type PropertyRequest =
  | { ok: true; propertyId: string; property: Property }
  | { ok: false; response: NextResponse };

/**
 * Just the id, unvalidated.
 *
 * `GET /api/watchlist` reads it this way on purpose: an unknown id there
 * returns an empty list rather than a 404, and the collector polls that
 * endpoint. Tightening it would be a behaviour change, not a refactor.
 */
export function propertyIdFromRequest(req: NextRequest | Request): string {
  return new URL(req.url).searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
}

export function propertyFromRequest(req: NextRequest | Request): PropertyRequest {
  const propertyId = propertyIdFromRequest(req);
  const property = getProperty(propertyId);
  if (!property) {
    return { ok: false, response: NextResponse.json({ error: 'unknown property' }, { status: 404 }) };
  }
  return { ok: true, propertyId, property };
}
