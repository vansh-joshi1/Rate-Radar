import type { RawEvent, SourceResult } from '../../lib/scoring/types';
import { venueCapacity } from '../../lib/scoring/venues';

/**
 * Ticketmaster Discovery API — events at the three big Nashville venues.
 * Queries by venueId (verified 2026-07-12) rather than lat/long: precise, and
 * avoids pulling every honky-tonk listing downtown.
 *
 * Real-world quirks handled (all observed in live data):
 * - Junk listings: "BetMGM Dinner Reservation", VIP upgrades, parking — these
 *   are classified Miscellaneous/Upsell/Parking and are filtered out.
 * - Duplicate cross-listings: the same show can appear twice (Ticketmaster +
 *   a SeatGeek/marketplace redirect) — deduped by date + normalized name.
 * - Cancelled/rescheduled-away events are skipped by status.
 */
const VENUES: { id: string; name: string }[] = [
  { id: 'KovZpZA7AnJA', name: 'Nissan Stadium' },
  { id: 'KovZpZA6taAA', name: 'Bridgestone Arena' },
  { id: 'KovZ917APYJ', name: 'GEODIS Park' },
];
const JUNK_NAME = /dinner reservation|vip|parking|club access|suite|pregame|pre-show|meal/i;
const JUNK_TYPE = new Set(['Upsell', 'Parking']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Discovery API rate-limits bursts (observed live: 429 on the 2nd venue) — retry with backoff. */
async function fetchWithRetry(url: string, label: string): Promise<Response> {
  const delays = [0, 2500, 6000];
  let last: Response | null = null;
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const res = await fetch(url);
    if (res.ok) return res;
    last = res;
    if (res.status !== 429 && res.status < 500) break; // 4xx other than 429 won't heal
  }
  throw new Error(`Ticketmaster HTTP ${last?.status} (${label})`);
}

export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { source: 'ticketmaster', status: 'awaiting-key', fetchedAt };

  try {
    const start = new Date();
    const end = new Date(start.getTime() + 22 * 86400_000);
    const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const all: { tm: TmEvent; venueName: string }[] = [];
    const venueErrors: string[] = [];
    for (const venue of VENUES) {
      try {
        let page = 0;
        let totalPages = 1;
        while (page < totalPages && page < 5) {
          const url =
            `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}` +
            `&venueId=${venue.id}&size=100&page=${page}` +
            `&startDateTime=${iso(start)}&endDateTime=${iso(end)}&sort=date,asc`;
          const res = await fetchWithRetry(url, venue.name);
          const json = (await res.json()) as {
            _embedded?: { events?: TmEvent[] };
            page?: { totalPages?: number };
          };
          for (const e of json._embedded?.events ?? []) all.push({ tm: e, venueName: venue.name });
          totalPages = json.page?.totalPages ?? 1;
          page += 1;
        }
      } catch (err) {
        // One venue failing (usually a stubborn 429) shouldn't blank the other
        // two — keep what we got, surface the gap honestly.
        venueErrors.push(String(err).slice(0, 120));
      }
      await sleep(400); // pace between venues — bursts are what trigger the 429s
    }
    if (all.length === 0 && venueErrors.length > 0) throw new Error(venueErrors.join(' · '));

    const real = all.filter(({ tm }) => {
      const cls = tm.classifications?.[0];
      if (JUNK_NAME.test(tm.name)) return false;
      if (cls?.type?.name && JUNK_TYPE.has(cls.type.name)) return false;
      if (cls?.segment?.name === 'Miscellaneous') return false;
      if (tm.dates?.status?.code === 'cancelled') return false;
      return Boolean(tm.dates?.start?.localDate);
    });

    // multi-night: same attraction+venue on more than one date
    const runCount = new Map<string, number>();
    for (const { tm, venueName } of real) {
      const k = `${tm._embedded?.attractions?.[0]?.id ?? tm.name}@${venueName}`;
      runCount.set(k, (runCount.get(k) ?? 0) + 1);
    }

    // dedupe cross-listings by date + normalized name
    const seen = new Set<string>();
    const events: RawEvent[] = [];
    for (const { tm, venueName } of real) {
      const date = tm.dates.start.localDate!;
      const dedupeKey = `${date}|${tm.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const runKey = `${tm._embedded?.attractions?.[0]?.id ?? tm.name}@${venueName}`;
      const isMusic = tm.classifications?.[0]?.segment?.name === 'Music';
      const cap = venueCapacity(venueName);
      // Competitions (DCI, cheer/dance championships) draw traveling families but
      // don't fill a stadium like a headliner tour — observed live: DCI at Nissan.
      const isCompetition = tm.classifications?.some((c) => c.subType?.name === 'Competition');
      events.push({
        ...(isCompetition && cap ? { expectedAttendance: Math.round(cap * 0.35) } : {}),
        id: `tm:${tm.id}`,
        name: tm.name,
        date,
        venue: venueName,
        capacity: cap,
        kind: isMusic ? 'concert' : 'sports',
        isTouring: isMusic, // a booked show at these venues is a touring production
        multiNight: (runCount.get(runKey) ?? 1) > 1,
        selloutLikely: (runCount.get(runKey) ?? 1) > 1 || (isMusic && (cap ?? 0) >= 40000),
        source: 'ticketmaster',
      });
    }

    return {
      source: 'ticketmaster',
      status: 'ok',
      fetchedAt,
      data: events,
      ...(venueErrors.length > 0 ? { error: `partial — ${venueErrors.join(' · ')}` } : {}),
    };
  } catch (err) {
    return { source: 'ticketmaster', status: 'failed', fetchedAt, error: String(err) };
  }
}

interface TmEvent {
  id: string;
  name: string;
  dates: { start: { localDate?: string }; status?: { code?: string } };
  classifications?: { segment?: { name?: string }; type?: { name?: string }; subType?: { name?: string } }[];
  _embedded?: { attractions?: { id?: string }[] };
}
