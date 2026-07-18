import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_PROPERTY_ID, getProperty, type Property } from '../../../lib/properties';
import { haversineMiles } from '../../../lib/geo';

export const dynamic = 'force-dynamic';

/**
 * Hotel name autocomplete for the watchlist.
 *
 * Primary: Photon (OSM) — built for search-as-you-type, so "ham" already
 * matches "Hampton Inn"; filtered to lodging types, biased to the property's
 * coordinates. Fallback: Nominatim (whole-word matching only) when Photon is
 * down or empty. Results within ~40mi, distance-sorted. Session-gated by the
 * middleware; the client debounces to respect both services' fair-use limits.
 */

interface Suggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMi: number;
  isLodging: boolean;
}

const MAX_MILES = 40;
const LODGING_TYPES = new Set(['hotel', 'motel', 'guest_house', 'hostel', 'apartment', 'chalet']);
const UA = { 'User-Agent': 'RateRadar/1.0 (github.com/vansh-joshi1/Rate-Radar)' };

async function photonSearch(q: string, property: Property): Promise<Suggestion[]> {
  const tags = ['tourism:hotel', 'tourism:motel', 'tourism:guest_house', 'tourism:hostel']
    .map((t) => `&osm_tag=${t}`)
    .join('');
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${property.lat}&lon=${property.lng}&limit=10${tags}`,
    { headers: UA, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const json = (await res.json()) as {
    features: {
      properties: { name?: string; housenumber?: string; street?: string; city?: string; state?: string; osm_key: string; osm_value: string };
      geometry: { coordinates: [number, number] };
    }[];
  };
  return json.features
    .filter((f) => f.properties.name)
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      return {
        name: p.name!,
        address: [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.city, p.state]
          .filter(Boolean)
          .join(', '),
        lat,
        lng,
        distanceMi: haversineMiles(property.lat, property.lng, lat, lng),
        isLodging: p.osm_key === 'tourism' && LODGING_TYPES.has(p.osm_value),
      };
    });
}

async function nominatimSearch(q: string, property: Property): Promise<Suggestion[]> {
  const box = 0.5;
  const viewbox = [property.lng - box, property.lat + box, property.lng + box, property.lat - box].join(',');
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(q)}`,
    { headers: UA, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const hits = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string; class: string; type: string }[];
  return hits.map((h) => {
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
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const propertyId = url.searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
  const property = getProperty(propertyId);
  if (!property) return NextResponse.json({ error: 'unknown property' }, { status: 404 });
  if (q.length < 3) return NextResponse.json({ results: [] });

  let results: Suggestion[] = [];
  try {
    results = await photonSearch(q, property);
  } catch {
    /* fall through to Nominatim */
  }
  if (results.length === 0) {
    try {
      results = await nominatimSearch(q, property);
    } catch {
      return NextResponse.json({ error: 'search unavailable' }, { status: 502 });
    }
  }

  results = results
    .filter((r) => r.distanceMi <= MAX_MILES)
    .sort((a, b) => Number(b.isLodging) - Number(a.isLodging) || a.distanceMi - b.distanceMi)
    .slice(0, 6);

  return NextResponse.json({ results });
}
