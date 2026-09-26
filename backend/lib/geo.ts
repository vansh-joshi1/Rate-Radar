/** Great-circle distance in miles, one decimal. */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export interface Located {
  lat: number;
  lng: number;
  /** "Franklin, TN" */
  city: string;
  /** IANA zone, e.g. America/Chicago */
  timezone: string;
}

/**
 * A US street address → coordinates, city and timezone, for approving a hotel.
 * Census geocoder for the point (free, no key, US addresses), then NWS points
 * for the timezone — the same service the collector already uses for alerts.
 * Null when either cannot place the address; the approver fixes it, rather
 * than a hotel being filed at a guessed location.
 */
export async function locateAddress(address: string): Promise<Located | null> {
  const census = await fetch(
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' +
      encodeURIComponent(address),
    { cache: 'no-store', signal: AbortSignal.timeout(8000) }
  ).catch(() => null);
  if (!census?.ok) return null;
  const match = ((await census.json()) as {
    result?: { addressMatches?: { coordinates: { x: number; y: number }; addressComponents?: { city?: string; state?: string } }[] };
  }).result?.addressMatches?.[0];
  if (!match) return null;
  const lat = match.coordinates.y;
  const lng = match.coordinates.x;

  const nws = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
    headers: { 'User-Agent': process.env.NWS_USER_AGENT ?? 'RateRadar (set NWS_USER_AGENT)', Accept: 'application/geo+json' },
    cache: 'no-store',
    // Both lookups run inside the approve request: a stalled service should fail it fast, not at the function timeout.
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!nws?.ok) return null;
  const timezone = ((await nws.json()) as { properties?: { timeZone?: string } }).properties?.timeZone;
  if (!timezone) return null;

  const { city, state } = match.addressComponents ?? {};
  const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return { lat, lng, timezone, city: city && state ? `${title(city)}, ${state}` : address };
}
