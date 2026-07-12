import type { RawEvent, SourceResult } from '../../lib/scoring/types';
import { venueCapacity } from '../../lib/scoring/venues';

const TRACKED_VENUES = ['nissan stadium', 'bridgestone arena', 'geodis park'];
const NASHVILLE_LATLONG = '36.1627,-86.7816';

/** Ticketmaster Discovery API — events at the three big Nashville venues, next 22 nights. */
export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { source: 'ticketmaster', status: 'awaiting-key', fetchedAt };

  try {
    const start = new Date();
    const end = new Date(start.getTime() + 22 * 86400_000);
    const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const url =
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}` +
      `&latlong=${NASHVILLE_LATLONG}&radius=10&unit=miles&size=200` +
      `&startDateTime=${iso(start)}&endDateTime=${iso(end)}&sort=date,asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
    const json = (await res.json()) as {
      _embedded?: { events?: TmEvent[] };
    };
    const all = json._embedded?.events ?? [];

    const tracked = all.filter((e) => {
      const venue = e._embedded?.venues?.[0]?.name?.toLowerCase() ?? '';
      return TRACKED_VENUES.some((v) => venue.includes(v));
    });

    // multi-night: same attraction + venue on >1 date in the window
    const runCount = new Map<string, number>();
    for (const e of tracked) {
      const k = `${e._embedded?.attractions?.[0]?.id ?? e.name}@${e._embedded?.venues?.[0]?.name}`;
      runCount.set(k, (runCount.get(k) ?? 0) + 1);
    }

    const events: RawEvent[] = tracked
      .filter((e) => e.dates?.start?.localDate)
      .map((e) => {
        const venue = e._embedded?.venues?.[0]?.name ?? 'unknown';
        const k = `${e._embedded?.attractions?.[0]?.id ?? e.name}@${venue}`;
        const isMusic = e.classifications?.[0]?.segment?.name === 'Music';
        const cap = venueCapacity(venue);
        return {
          id: `tm:${e.id}`,
          name: e.name,
          date: e.dates.start.localDate,
          venue,
          capacity: cap,
          kind: isMusic ? ('concert' as const) : ('sports' as const),
          isTouring: isMusic, // a booked show at these venues is a touring production
          multiNight: (runCount.get(k) ?? 1) > 1,
          selloutLikely: (runCount.get(k) ?? 1) > 1 || (isMusic && (cap ?? 0) >= 40000),
          source: 'ticketmaster',
        };
      });

    return { source: 'ticketmaster', status: 'ok', fetchedAt, data: events };
  } catch (err) {
    return { source: 'ticketmaster', status: 'failed', fetchedAt, error: String(err) };
  }
}

interface TmEvent {
  id: string;
  name: string;
  dates: { start: { localDate?: string } };
  classifications?: { segment?: { name?: string } }[];
  _embedded?: {
    venues?: { name?: string }[];
    attractions?: { id?: string }[];
  };
}
