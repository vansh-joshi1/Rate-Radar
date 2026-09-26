import type { SourceResult, WeatherAlert } from '../../lib/scoring/types';

/**
 * NWS active alerts.
 *
 * The original property: Williamson County (Franklin) + Davidson County
 * (Nashville). Fetches all active TN alerts and filters by county name in
 * areaDesc — more robust than hardcoded zone codes, which change and are easy
 * to get wrong.
 *
 * Any other hotel: `?point=lat,lng`, which NWS resolves to whatever zones and
 * counties contain the hotel, so no per-market county list is needed.
 *
 * api.weather.gov requires a descriptive User-Agent — set NWS_USER_AGENT.
 * Note: winter weather can INCREASE short-notice demand (stranded
 * travelers), so alerts are tagged isWinter and never treated as automatically
 * negative for the hotel.
 */
const COUNTIES = ['Williamson', 'Davidson'];
const WINTER = /winter|ice|snow|blizzard|freez/i;

export async function collect(point?: { lat: number; lng: number }): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const query = point ? `point=${point.lat.toFixed(4)},${point.lng.toFixed(4)}` : 'area=TN';
    const res = await fetch(`https://api.weather.gov/alerts/active?${query}`, {
      headers: {
        'User-Agent': process.env.NWS_USER_AGENT ?? 'RateRadar (set NWS_USER_AGENT)',
        Accept: 'application/geo+json',
      },
    });
    if (!res.ok) throw new Error(`NWS HTTP ${res.status}`);
    const json = (await res.json()) as {
      features: { properties: { event: string; severity: string; headline: string; areaDesc: string } }[];
    };

    const alerts: WeatherAlert[] = [];
    for (const f of json.features ?? []) {
      // A point query already returns only the alerts covering the hotel.
      const matched = point ? [] : COUNTIES.filter((c) => f.properties.areaDesc?.includes(c));
      if (!point && matched.length === 0) continue;
      alerts.push({
        event: f.properties.event,
        severity: f.properties.severity,
        headline: f.properties.headline,
        isWinter: WINTER.test(f.properties.event),
        area: point ? f.properties.areaDesc : matched.map((c) => `${c} County`).join(' + '),
      });
    }
    return { source: 'nws', status: 'ok', fetchedAt, data: alerts };
  } catch (err) {
    return { source: 'nws', status: 'failed', fetchedAt, error: String(err) };
  }
}
