import type { SourceResult, WeatherAlert } from '../../lib/scoring/types';

/**
 * NWS active alerts for Williamson County (Franklin) + Davidson County (Nashville).
 * Fetches all active TN alerts and filters by county name in areaDesc — more
 * robust than hardcoded zone codes, which change and are easy to get wrong.
 * api.weather.gov requires a descriptive User-Agent — set NWS_USER_AGENT.
 * Note: winter weather can INCREASE short-notice demand (stranded I-65
 * travelers), so alerts are tagged isWinter and never treated as automatically
 * negative for the hotel.
 */
const COUNTIES = ['Williamson', 'Davidson'];
const WINTER = /winter|ice|snow|blizzard|freez/i;

export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch('https://api.weather.gov/alerts/active?area=TN', {
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
      const matched = COUNTIES.filter((c) => f.properties.areaDesc?.includes(c));
      if (matched.length === 0) continue;
      alerts.push({
        event: f.properties.event,
        severity: f.properties.severity,
        headline: f.properties.headline,
        isWinter: WINTER.test(f.properties.event),
        area: matched.map((c) => `${c} County`).join(' + '),
      });
    }
    return { source: 'nws', status: 'ok', fetchedAt, data: alerts };
  } catch (err) {
    return { source: 'nws', status: 'failed', fetchedAt, error: String(err) };
  }
}
