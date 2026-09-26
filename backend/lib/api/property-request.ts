import { NextResponse, type NextRequest } from 'next/server';
import { getStore, storeFor, type Store } from '../store';
import { loadProperty, type Property } from '../properties';
import { demoSid, requestProperty, requestStore } from '../demo/context';

/**
 * Which property a dashboard API request is about, and the store its data lives in.
 *
 * Deliberately NOT part of `lib/api/context.ts`: that module serves the
 * versioned public API, which authenticates by key and answers in a
 * `{ error: { code, message } }` envelope. These routes answer the dashboard's
 * own callers in a flat `{ error }` shape.
 *
 * The property comes from WHO is asking, never from the URL alone. A member
 * gets their own hotel; a `?propertyId=` naming any other one is refused, not
 * honoured — otherwise one hotel could read another's rates by editing a query
 * string. The one caller allowed to name a property is the collector, which
 * holds INGEST_SECRET and collects for every hotel.
 */
export type PropertyRequest =
  | { ok: true; propertyId: string; property: Property; store: Store }
  | { ok: false; response: NextResponse };

export function isCollector(req: NextRequest | Request): boolean {
  const secret = process.env.INGEST_SECRET;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function propertyFromRequest(req: NextRequest | Request): Promise<PropertyRequest> {
  const explicit = new URL(req.url).searchParams.get('propertyId');

  if (isCollector(req) && !demoSid()) {
    const property = explicit ? await loadProperty(getStore(), explicit) : undefined;
    if (!property) return { ok: false, response: NextResponse.json({ error: 'unknown property' }, { status: 404 }) };
    return { ok: true, propertyId: property.id, property, store: storeFor(property.id) };
  }

  const property = await requestProperty();
  if (explicit && explicit !== property.id) {
    return { ok: false, response: NextResponse.json({ error: 'not your property' }, { status: 403 }) };
  }
  return { ok: true, propertyId: property.id, property, store: await requestStore() };
}
