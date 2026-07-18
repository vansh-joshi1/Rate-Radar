import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { haversineMiles } from '../../../lib/geo';

export const dynamic = 'force-dynamic';

/**
 * Hotel name autocomplete for the watchlist — proxies OSM Nominatim, bounded
 * to a ~35mi box around the property so "hampton inn" means the one near YOU.
 * Results are distance-sorted, lodging-typed results first. Session-gated by
 * the middleware. Nominatim allows 1 req/s — the client debounces; keep it
 * that way.
 */

interface NominatimHit {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
}

const BOX_DEG = 0.5; // ~35mi latitude; wide enough for a metro compset
const LODGING_TYPES = new Set(['hotel', 'motel', 'guest_house', 'hostel', 'apartment', 'chalet']);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const propertyId = url.searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
  const property = getProperty(propertyId);
  if (!property) return NextResponse.json({ error: 'unknown property' }, { status: 404 });
  if (q.length < 3) return NextResponse.json({ results: [] });

  const viewbox = [
    property.lng - BOX_DEG, property.lat + BOX_DEG,
    property.lng + BOX_DEG, property.lat - BOX_DEG,
  ].join(',');

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'RateRadar/1.0 (github.com/vansh-joshi1/Rate-Radar)' }, cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ error: `search unavailable (${res.status})` }, { status: 502 });
    const hits = (await res.json()) as NominatimHit[];

    const results = hits
      .map((h) => {
        const lat = Number(h.lat);
        const lng = Number(h.lon);
        return {
          name: h.name || h.display_name.split(',')[0].trim(),
          address: h.display_name.split(',').slice(1, 4).join(',').trim(),
          lat,
          lng,
          distanceMi: haversineMiles(property.lat, property.lng, lat, lng),
          isLodging: h.class === 'tourism' && LODGING_TYPES.has(h.type),
        };
      })
      .sort((a, b) => Number(b.isLodging) - Number(a.isLodging) || a.distanceMi - b.distanceMi)
      .slice(0, 6);

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: `search failed: ${String(err).slice(0, 120)}` }, { status: 502 });
  }
}
