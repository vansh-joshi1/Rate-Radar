'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EventPin } from './EventsMap';
import DemandCalendar from './DemandCalendar';

/*
 * Market Intelligence, built to the supplied design: an event map, a weather
 * impact panel, an upcoming-events list, and a demand-intensity calendar.
 *
 * Two of the design's figures have no source in this system and are handled
 * honestly rather than invented:
 *   - The mock shows a temperature ("68°"). The NWS collector fetches ALERTS
 *     only — there is no forecast temperature anywhere — so the panel reports
 *     the active alert and its demand read instead of a number nobody measured.
 *   - Map pins need venue coordinates. Known venues are in VENUE_COORDS;
 *     anything else is listed but not plotted, and the caption says how many
 *     were placed, so an unplotted event never looks like a missing event.
 */

// Leaflet touches `window` — keep it out of the server bundle entirely.
const EventsMap = dynamic(() => import('./EventsMap'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 z-0 bg-[#0B1C30]" />,
});

const Icon = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden>
    {name}
  </span>
);

export interface MIEvent {
  id: string;
  name: string;
  venue: string;
  date: string;
  kind: string;
  attendance: number;
  score: number;
  tier: string;
  verdict: string;
  lat: number | null;
  lng: number | null;
  miles: number | null;
}

export interface MINight {
  date: string;
  nightScore: number;
  holidayName?: string;
  topEvent?: string;
}

interface Props {
  property: { name: string; lat: number; lng: number };
  events: MIEvent[];
  nights: MINight[];
  weather: { note?: string; bnaNote?: string } | null;
  /** Property-local today as rendered on the server; the calendar keeps it live. */
  today: string;
  /** The property's IANA zone — the night being priced is its local night. */
  timeZone: string;
}

/* Event families the design's filter row exposes. Kinds are collapsed onto
   these three so the checkboxes map onto data that actually exists. */
const FAMILIES = [
  { key: 'conference', label: 'Conferences', kinds: ['convention', 'university'], dot: 'bg-accent' },
  { key: 'concert', label: 'Concerts', kinds: ['concert'], dot: 'bg-[#84f9c3]' },
  { key: 'sports', label: 'Sports', kinds: ['sports'], dot: 'bg-[#5b94fd]' },
] as const;

const KIND_LABEL: Record<string, string> = {
  convention: 'Conference',
  university: 'University',
  concert: 'Concert',
  sports: 'Sports',
  holiday: 'Holiday',
  other: 'Event',
};

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const monthLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function MarketIntelligence({ property, events, nights, weather, today, timeZone }: Props) {
  const [active, setActive] = useState<string[]>(FAMILIES.map((f) => f.key));

  const familyOf = (kind: string) => FAMILIES.find((f) => (f.kinds as readonly string[]).includes(kind))?.key ?? 'conference';

  const visible = useMemo(
    () => events.filter((e) => active.includes(familyOf(e.kind))),
    [events, active],
  );

  const pins: EventPin[] = useMemo(
    () =>
      visible
        .filter((e): e is MIEvent & { lat: number; lng: number } => e.lat != null && e.lng != null)
        .map((e) => ({
          id: e.id,
          name: e.name,
          venue: e.venue,
          lat: e.lat,
          lng: e.lng,
          kind: e.kind,
          attendance: e.attendance,
          date: e.date,
          score: e.score,
        })),
    [visible],
  );

  const unplotted = visible.length - pins.length;

  return (
    <div className="grid grid-cols-1 gap-lg md:grid-cols-8 lg:grid-cols-12">
      {/* Header */}
      <div className="col-span-1 mb-sm flex flex-wrap items-end justify-between gap-md md:col-span-8 lg:col-span-12">
        <div>
          <h2 className="mb-xs font-headline-lg text-headline-lg text-ink">Market Intelligence</h2>
          <p className="font-body-lg text-body-lg text-muted">
            Analyze local events and demand signals to optimize rate strategy.
          </p>
        </div>
        <div className="flex gap-sm">
          <span className="flex items-center gap-xs rounded border border-line bg-card px-md py-sm font-label-md text-label-md text-ink">
            <Icon name="calendar_today" className="text-[18px]" />
            {nights.length > 0 ? monthLabel(nights[0].date) : '—'}
          </span>
          <span className="flex items-center gap-xs rounded border border-line bg-card px-md py-sm font-label-md text-label-md text-muted">
            <Icon name="filter_list" className="text-[18px]" />
            {visible.length} of {events.length} events
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="relative col-span-1 flex h-[600px] flex-col overflow-hidden rounded border border-line bg-[#0B1C30] shadow-overlay-sm md:col-span-8 lg:col-span-8">
        <EventsMap property={property} pins={pins} />

        <div className="pointer-events-none absolute left-md right-md top-md z-[400] flex flex-wrap justify-between gap-sm">
          <div className="pointer-events-auto flex gap-md rounded border border-[#2f3035] bg-[#1a1b20]/90 p-sm shadow-overlay-sm backdrop-blur-md">
            {FAMILIES.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center gap-xs font-label-md text-label-md text-[#f0f0f7]"
              >
                <input
                  type="checkbox"
                  checked={active.includes(f.key)}
                  onChange={(e) =>
                    setActive((prev) => (e.target.checked ? [...prev, f.key] : prev.filter((k) => k !== f.key)))
                  }
                  className="rounded-sm border-[#44474d] bg-[#2f3035] text-accent focus:ring-accent"
                />
                <span className={`h-2 w-2 rounded-full ${f.dot}`} />
                {f.label}
              </label>
            ))}
          </div>
          <div className="pointer-events-auto flex items-center gap-sm rounded border border-[#2f3035] bg-[#1a1b20]/90 p-sm shadow-overlay-sm backdrop-blur-md">
            <Icon name="my_location" className="text-accent" />
            <span className="font-label-md text-label-md text-[#f0f0f7]">{property.name}</span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-md left-md z-[400] rounded border border-[#2f3035] bg-[#1a1b20]/90 px-sm py-1 font-label-md text-[10px] uppercase tracking-wider text-[#b7c7e2] backdrop-blur-md">
          {pins.length} event{pins.length === 1 ? '' : 's'} plotted
          {unplotted > 0 && ` · ${unplotted} without a known venue location`}
        </div>
      </div>

      {/* Right column */}
      <div className="col-span-1 flex flex-col gap-lg md:col-span-8 lg:col-span-4">
        {/* Weather & impact */}
        <div className="rounded border border-line bg-card p-md transition-shadow hover:shadow-hover-lift">
          <h3 className="mb-md flex items-center gap-xs font-label-md text-label-md uppercase text-muted">
            <Icon name="partly_cloudy_day" className="text-[18px]" /> Forecast &amp; Impact
          </h3>
          {weather?.note || weather?.bnaNote ? (
            <div className="space-y-sm">
              {weather.note && (
                <div className="flex items-start gap-md">
                  <Icon name="rainy" className="text-[32px] font-light text-ink" />
                  <p className="font-body-md text-body-md text-ink">{weather.note}</p>
                </div>
              )}
              {weather.bnaNote && (
                <div className="flex items-start gap-md border-t border-line pt-sm">
                  <Icon name="flight" className="text-[24px] text-muted" />
                  <p className="font-body-md text-body-md text-ink">{weather.bnaNote}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-md">
              <Icon name="check_circle" className="text-[32px] font-light text-ok" />
              <div>
                <p className="font-body-md text-body-md text-ink">No active weather or airport alerts.</p>
                <p className="text-xs text-muted">
                  Alerts only — this system records advisories, not a temperature forecast.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="flex h-[426px] flex-col rounded border border-line bg-card transition-shadow hover:shadow-hover-lift">
          <div className="flex items-center justify-between border-b border-line bg-paper p-md">
            <h3 className="font-label-md text-label-md uppercase text-ink">Upcoming Events</h3>
            <span className="rounded bg-accent/10 px-2 py-1 font-data-mono text-[10px] uppercase text-accent">
              {nights.length}-night window
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-md font-body-md text-body-md text-muted">
                {events.length === 0
                  ? 'No demand events in this window — rates fall back to day-of-week baselines.'
                  : 'No events match the selected filters.'}
              </p>
            ) : (
              visible.map((e) => (
                <div
                  key={e.id}
                  className="group cursor-pointer border-b border-line p-md transition-colors last:border-0 hover:bg-paper hover:shadow-hover-lift"
                  title={e.verdict}
                >
                  <div className="mb-sm flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <span className="mb-1 block font-label-md text-[10px] font-bold uppercase tracking-wider text-accent">
                        {KIND_LABEL[e.kind] ?? 'Event'}
                        {e.tier === 'too-small' && ' · too small to matter'}
                      </span>
                      <h4 className="font-headline-md text-[16px] leading-tight text-ink transition-colors group-hover:text-accent">
                        {e.name}
                      </h4>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-data-mono text-data-mono font-bold tabular-nums text-ink">
                        {e.attendance.toLocaleString()}
                      </p>
                      <p className="font-label-md text-[10px] uppercase text-muted">Attendees</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-md font-body-md text-sm text-muted">
                    <span className="flex items-center gap-xs">
                      <Icon name="calendar_today" className="text-[16px]" /> {fmtDay(e.date)}
                    </span>
                    <span className="flex min-w-0 items-center gap-xs">
                      <Icon name="location_on" className="text-[16px]" />
                      <span className="truncate">
                        {e.venue}
                        {e.miles != null && ` (${e.miles.toFixed(1)}m)`}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Demand calendar */}
      <div className="col-span-1 md:col-span-8 lg:col-span-12">
        <DemandCalendar nights={nights} today={today} timeZone={timeZone} />
      </div>
    </div>
  );
}
