import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '../../../auth';
import { getStore } from '../../../lib/store';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { hasHotel, loadWatchlist, normalizeName, saveWatchlist, type WatchlistHotel } from '../../../lib/watchlist';

export const dynamic = 'force-dynamic';

/**
 * Competitor watchlist CRUD. Self-authenticated (excluded from the cookie
 * middleware) because it serves two callers:
 *   - the dashboard UI (session cookie)
 *   - the GitHub Actions collector fetching the current whitelist (INGEST_SECRET)
 *
 * Geocoding uses OSM Nominatim (free, 1 req/s) at add/locate time only — the
 * result is stored, so the map never geocodes at render time. A hotel that
 * fails to geocode still joins the watchlist (it matches prices); it just has
 * no map pin until located.
 */

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get('authorization');
  if (process.env.INGEST_SECRET && bearer === `Bearer ${process.env.INGEST_SECRET}`) return true;
  return Boolean((await auth())?.user);
}

function propertyIdFrom(req: NextRequest): string {
  return new URL(req.url).searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
}

async function geocode(name: string, city: string): Promise<Pick<WatchlistHotel, 'lat' | 'lng' | 'address'>> {
  try {
    const q = `${name}, ${city}`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'RateRadar/1.0 (github.com/vansh-joshi1/Rate-Radar)' }, cache: 'no-store' }
    );
    if (!res.ok) return {};
    const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!hits.length) return {};
    return {
      lat: Number(hits[0].lat),
      lng: Number(hits[0].lon),
      address: hits[0].display_name.split(',').slice(0, 3).join(',').trim(),
    };
  } catch {
    return {}; // geocoding is best-effort; the entry still works without a pin
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const propertyId = propertyIdFrom(req);
  const hotels = await loadWatchlist(getStore(), propertyId);
  return NextResponse.json({ propertyId, hotels });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const propertyId = propertyIdFrom(req);
  const property = getProperty(propertyId);
  if (!property) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    lat?: number;
    lng?: number;
    address?: string;
  };
  const clean = body.name ? normalizeName(body.name) : '';
  if (!clean || clean.length < 3 || clean.length > 80) {
    return NextResponse.json({ error: 'name must be 3–80 characters' }, { status: 400 });
  }

  const store = getStore();
  const hotels = await loadWatchlist(store, propertyId);
  if (hasHotel(hotels, clean)) return NextResponse.json({ error: 'already on the watchlist' }, { status: 409 });
  if (hotels.length >= 25) return NextResponse.json({ error: 'watchlist is capped at 25 hotels' }, { status: 400 });

  // Coords supplied by the hotel-search picker skip the geocoding round-trip.
  const located =
    Number.isFinite(body.lat) && Number.isFinite(body.lng)
      ? { lat: body.lat!, lng: body.lng!, address: body.address?.slice(0, 120) }
      : await geocode(clean, property.city);
  const hotel: WatchlistHotel = { name: clean, addedAt: new Date().toISOString(), ...located };
  await saveWatchlist(store, propertyId, [...hotels, hotel]);
  return NextResponse.json({ hotel, located: hotel.lat != null });
}

/** PATCH { name } — (re)geocode an existing entry that has no pin yet. */
export async function PATCH(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const propertyId = propertyIdFrom(req);
  const property = getProperty(propertyId);
  if (!property) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const store = getStore();
  const hotels = await loadWatchlist(store, propertyId);
  const idx = hotels.findIndex((h) => h.name.toLowerCase() === (name ?? '').toLowerCase());
  if (idx === -1) return NextResponse.json({ error: 'not on the watchlist' }, { status: 404 });

  const located = await geocode(hotels[idx].name, property.city);
  if (located.lat == null) return NextResponse.json({ located: false, hotel: hotels[idx] });
  hotels[idx] = { ...hotels[idx], ...located };
  await saveWatchlist(store, propertyId, hotels);
  return NextResponse.json({ located: true, hotel: hotels[idx] });
}

export async function DELETE(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const propertyId = propertyIdFrom(req);
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const store = getStore();
  const hotels = await loadWatchlist(store, propertyId);
  const remaining = hotels.filter((h) => h.name.toLowerCase() !== (name ?? '').toLowerCase());
  if (remaining.length === hotels.length) return NextResponse.json({ error: 'not on the watchlist' }, { status: 404 });
  await saveWatchlist(store, propertyId, remaining);
  return NextResponse.json({ ok: true, count: remaining.length });
}
