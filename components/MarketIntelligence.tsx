'use client';
import { useMemo, useState } from 'react';
import { CloudWarningIcon } from '@phosphor-icons/react/dist/ssr/CloudWarning';
import { AirplaneTiltIcon } from '@phosphor-icons/react/dist/ssr/AirplaneTilt';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle';
import EventMap, { band, scaleFor, useVenueBlips, venueKey, type MapEvent } from './EventMap';
import DemandCalendar, { type CalendarNight } from './DemandCalendar';
import { Bezel } from './landing/Machined';
import { fmtDay, fmtDow, noonUTC } from '../lib/date';

/*
 * Market Intelligence, on the Machined Instrument language (DESIGN.md).
 *
 * The bento is a 7/5 split over full-width rows:
 *   - The event map (navy core): every scored event with a known venue,
 *     on a themed map with range rings around the property. Weather and airport
 *     alerts sit under it, because they are the same kind of reading: outside
 *     pressure on tonight's demand, straight from a collector.
 *   - Upcoming events (light core), linked to the map both ways.
 *   - The demand calendar, full width.
 *
 * Two figures have no source in this system and are handled honestly rather
 * than invented:
 *   - There is no forecast temperature. The NWS collector fetches ALERTS only,
 *     so the weather reading reports the active alert, or that there is none.
 *   - A blip needs venue coordinates. Events at a venue we have no location
 *     for are listed and named under the map, never silently left off.
 */

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

/** A forecast night, with its rate and every event on it (the calendar's detail). */
export type MINight = CalendarNight;

interface Props {
  property: { name: string; lat: number; lng: number };
  events: MIEvent[];
  nights: MINight[];
  weather: { note?: string; bnaNote?: string } | null;
  isDemo: boolean;
  /** Property-local today as rendered on the server; the calendar keeps it live. */
  today: string;
  /** The property's IANA zone: the night being priced is its local night. */
  timeZone: string;
}

/* Event families for the filter. Every kind the scorer emits lands in exactly
   one, so filtering can never hide an event that has no pill to bring it back. */
const FAMILIES = [
  { key: 'conference', label: 'Conferences', kinds: ['convention', 'university'] },
  { key: 'concert', label: 'Concerts', kinds: ['concert'] },
  { key: 'sports', label: 'Sports', kinds: ['sports'] },
  { key: 'other', label: 'Other', kinds: ['holiday', 'other'] },
] as const;

const familyOf = (kind: string) =>
  FAMILIES.find((f) => (f.kinds as readonly string[]).includes(kind))?.key ?? 'other';

const KIND_LABEL: Record<string, string> = {
  convention: 'Conference',
  university: 'University',
  concert: 'Concert',
  sports: 'Sports',
  holiday: 'Holiday',
  other: 'Event',
};

const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';
const CHIP = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium';
const QUIET = 'bg-[#0b1c30]/[0.05] text-[#44474d]';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/* Demand chips, DESIGN.md → Chips. The map's blips use the same bands. */
const BAND_CHIP = {
  major: { label: 'Major', cls: 'bg-[#085ac0] text-white' },
  meaningful: { label: 'Meaningful', cls: 'bg-[#e5eeff] text-[#085ac0]' },
  minor: { label: 'Minor', cls: 'bg-[#1a1b20]/[0.10] text-[#1a1b20]' },
  quiet: { label: 'Quiet', cls: QUIET },
} as const;

const LEGEND = [
  { label: 'Major', swatch: 'bg-[#085ac0] ring-2 ring-white' },
  { label: 'Meaningful', swatch: 'bg-[#adc6ff]' },
  { label: 'Minor', swatch: 'bg-white/60' },
  { label: 'Too small', swatch: 'bg-[#0b1c30] ring-1 ring-inset ring-white/50' },
];

export default function MarketIntelligence({ property, events, nights, weather, isDemo, today, timeZone }: Props) {
  const present = FAMILIES.filter((f) => events.some((e) => familyOf(e.kind) === f.key));
  const [off, setOff] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  /** The night picked on the scrubber; null is the whole window. */
  const [night, setNight] = useState<string | null>(null);

  const visible = useMemo(
    () => events.filter((e) => !off.includes(familyOf(e.kind)) && (night == null || e.date === night)),
    [events, off, night],
  );

  const isPlaced = (e: MIEvent): e is MIEvent & { lat: number; lng: number } => e.lat != null && e.lng != null;
  const located = useMemo(() => visible.filter(isPlaced), [visible]);
  const unlocated = visible.filter((e) => !isPlaced(e));

  const mapEvents: MapEvent[] = located;
  const blips = useVenueBlips(property, mapEvents);
  // Scaled on every placed event, so filtering never moves the frame.
  const { range, step } = useMemo(() => scaleFor(property, events.filter(isPlaced)), [property, events]);
  // A pin whose venue has been filtered away describes nothing.
  const pinnedLive = pinned && blips.some((b) => b.key === pinned) ? pinned : null;
  const active = hovered ?? pinnedLive;

  const hasAlerts = Boolean(weather?.note || weather?.bnaNote);
  const first = nights[0]?.date;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-tighter md:text-[40px]">
            Market intelligence
          </h1>
          <p className="mt-2 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
            The events and alerts that move demand near you, and how close each one is.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:flex-nowrap">
          {isDemo ? (
            <span className={`${CHIP} ${QUIET}`} title="Rendered from sample data, not a live feed">
              Sample data
            </span>
          ) : (
            <span className={`${CHIP} bg-[#029768]/[0.08] text-[#027a55]`}>Live</span>
          )}
          {first && (
            <span className={`${CHIP} ${QUIET} font-geist-mono tabular-nums`}>
              {nights.length} nights from {fmtDow(first)}, {fmtDay(first)}
            </span>
          )}
        </div>
      </header>

      {/* The 7/5 split waits for xl: at 1024-1279px the 5 columns left the list
          about 200px wide, breaking every event name one word per line. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Event map: every blip is a scored event, so the core is navy. */}
        <Bezel tone="data" className="xl:col-span-7" core="flex h-full flex-col p-6 text-white md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="event-map" className="scroll-mt-24 text-[22px] font-semibold tracking-tight">Event map</h2>
            <span className="font-geist-mono text-[12px] tabular-nums text-[#adc6ff]">
              {located.length} of {visible.length} placed, rings every {step} mi
            </span>
          </div>

          <div className="relative mt-6 rounded-[1.5rem] bg-white/[0.04] p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <EventMap
              property={property}
              blips={blips}
              range={range}
              step={step}
              hidePlaceNames={isDemo}
              active={active}
              pinned={pinnedLive}
              onHover={setHovered}
              onPin={setPinned}
            />
            {blips.length === 0 && (
              <p className="pointer-events-none absolute inset-x-6 top-6 z-10 text-center text-[14px] text-white/70">
                {visible.length === 0
                  ? night
                    ? `No events on ${fmtDow(night)}, ${fmtDay(night)}.`
                    : 'No events to place in this window.'
                  : 'None of these venues has a location on file yet.'}
              </p>
            )}
          </div>

          <NightScrubber
            nights={nights}
            events={events}
            selected={night}
            onSelect={(d) => {
              setNight(d);
              setPinned(null);
            }}
          />

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-2 text-[13px] text-white/70">
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${l.swatch}`} />
                {l.label}
              </span>
            ))}
            <span className="text-[13px] text-white/50">Size is expected attendance</span>
          </div>

          {unlocated.length > 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-white/60">
              Not on the map, no venue location on file:{' '}
              <span className="text-white/80">{[...new Set(unlocated.map((e) => e.venue))].join(', ')}</span>. Still
              listed and still scored.
            </p>
          )}

          <div className="mt-6 h-px bg-white/[0.08]" />

          <div className={`mt-5 grid gap-4 ${weather?.note && weather?.bnaNote ? 'sm:grid-cols-2' : ''}`}>
            {hasAlerts ? (
              <>
                {weather?.note && (
                  <AlertReading icon={<CloudWarningIcon weight="light" className="h-5 w-5" />} label="Weather alert">
                    {weather.note}
                  </AlertReading>
                )}
                {weather?.bnaNote && (
                  <AlertReading icon={<AirplaneTiltIcon weight="light" className="h-5 w-5" />} label="Airport">
                    {weather.bnaNote}
                  </AlertReading>
                )}
              </>
            ) : (
              <AlertReading
                icon={<CheckCircleIcon weight="light" className="h-5 w-5 text-[#84f9c3]" />}
                label="Weather and airport"
              >
                No active alerts. This records advisories, not a temperature forecast.
              </AlertReading>
            )}
          </div>
        </Bezel>

        {/* Upcoming events. From xl the panel takes zero height of its own and
            stretches to the map beside it (h-0 + min-h-full), so a long list
            scrolls inside rather than stretching the row; stacked, it caps at
            760px instead. */}
        <Bezel className="xl:col-span-5 xl:h-0 xl:min-h-full" core="flex h-full max-h-[760px] flex-col overflow-hidden xl:max-h-none">
          <div className="space-y-4 p-6 pb-4 md:px-8 md:pt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[22px] font-semibold tracking-tight">Upcoming events</h2>
              <span className={`${MONO_LABEL} tabular-nums`}>
                {visible.length} of {events.length}
              </span>
            </div>
            {present.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by event type">
                {present.map((f) => {
                  const on = !off.includes(f.key);
                  const count = events.filter((e) => familyOf(e.kind) === f.key).length;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setOff((prev) => (on ? [...prev, f.key] : prev.filter((k) => k !== f.key)))}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] motion-reduce:transition-none ${FOCUS} ${
                        on
                          ? 'bg-[#e5eeff] text-[#085ac0]'
                          : 'bg-white text-[#44474d] ring-1 ring-[#0b1c30]/[0.1] hover:bg-[#f3f5fc]'
                      }`}
                    >
                      {f.label}
                      <span className="font-geist-mono text-[12px] tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-[#0b1c30]/[0.06]" />

          {visible.length === 0 ? (
            <p className="m-6 rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d] md:m-8">
              {events.length === 0
                ? 'No demand events in this window. Rates fall back to day-of-week baselines.'
                : night
                  ? `No events on ${fmtDow(night)}, ${fmtDay(night)}${off.length > 0 ? ' among the selected types' : ''}.`
                  : 'No events match the selected types.'}
            </p>
          ) : (
            <ol className="min-h-0 flex-1 divide-y divide-[#0b1c30]/[0.06] overflow-y-auto overscroll-contain">
              {visible.map((e) => {
                const key = e.lat != null && e.lng != null ? venueKey({ lat: e.lat, lng: e.lng }) : null;
                const lit = key != null && key === active;
                const small = e.tier === 'too-small';
                const chip = small ? { label: 'Too small to matter', cls: QUIET } : BAND_CHIP[band(e.score)];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={key == null}
                      onMouseEnter={() => key && setHovered(key)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => key && setHovered(key)}
                      onBlur={() => setHovered(null)}
                      onClick={() => key && setPinned((p) => (p === key ? null : key))}
                      aria-pressed={key != null ? pinnedLive === key : undefined}
                      title={`${KIND_LABEL[e.kind] ?? 'Event'}. ${e.verdict}`}
                      className={`grid w-full grid-cols-[3rem_1fr] gap-4 px-6 py-4 text-left transition-colors duration-150 disabled:cursor-default md:px-8 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0 ${
                        lit ? 'bg-[#f3f5fc]' : 'enabled:hover:bg-[#f8f9ff]'
                      }`}
                    >
                      <span className="text-center">
                        <span className="block font-geist-mono text-[12px] text-[#44474d]">{fmtDow(e.date)}</span>
                        <span className="block text-[22px] font-semibold leading-tight tracking-tight tabular-nums">
                          {noonUTC(e.date).getUTCDate()}
                        </span>
                      </span>
                      <span className={`min-w-0 ${small ? 'opacity-70' : ''}`}>
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-[15px] font-medium leading-snug">{e.name}</span>
                          <span className="shrink-0 text-right font-geist-mono text-[14px] tabular-nums">
                            {e.attendance.toLocaleString()}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                          <span className="flex min-w-0 max-w-full items-baseline gap-2 text-[13px] text-[#44474d]">
                            <span className="min-w-0 truncate">{e.venue}</span>
                            {e.miles != null && (
                              <span className="shrink-0 font-geist-mono text-[12px] tabular-nums">
                                {e.miles < 10 ? e.miles.toFixed(1) : Math.round(e.miles)} mi
                              </span>
                            )}
                          </span>
                          <span className={`${CHIP} ${chip.cls}`}>{chip.label}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="border-t border-[#0b1c30]/[0.06] px-6 py-4 text-[13px] leading-relaxed text-[#44474d] md:px-8">
            Figures are expected attendance. Hover or tap an event to find it on the map.
          </p>
        </Bezel>

        <div className="xl:col-span-12">
          <DemandCalendar
            nights={nights}
            today={today}
            timeZone={timeZone}
            onShowOnMap={(d) => {
              // The calendar's night becomes the scrubber's night, then the map comes into view.
              setNight(d);
              setPinned(null);
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              document.getElementById('event-map')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* Scrubber bars share the blips' bands, drawn for a navy surface. */
const BAR: Record<ReturnType<typeof band>, string> = {
  major: 'bg-[#085ac0] ring-1 ring-inset ring-white/60',
  meaningful: 'bg-[#adc6ff]',
  minor: 'bg-white/45',
  quiet: 'bg-white/[0.14]',
};

/**
 * One bar per forecast night, height and fill from the night's demand score.
 * Picking a night filters the map and the list to that night's events; the
 * map's frame stays put, so the blips that remain are read against the same
 * rings. An event is dated to its first night, as in the list.
 */
function NightScrubber({
  nights,
  events,
  selected,
  onSelect,
}: {
  nights: MINight[];
  events: MIEvent[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  if (nights.length < 2) return null;
  const count = (d: string) => events.filter((e) => e.date === d).length;
  const sel = selected ? nights.find((n) => n.date === selected) : undefined;
  const plural = (n: number) => `${n} event${n === 1 ? '' : 's'}`;

  return (
    <div className="mt-6">
      <div className="flex min-h-7 items-center justify-between gap-4">
        <p className="min-w-0 truncate text-[13px] text-white/60">
          <span className="font-geist-mono text-[12px] text-[#adc6ff]">
            {sel ? `${fmtDow(sel.date)}, ${fmtDay(sel.date)}` : 'Demand by night'}
          </span>
          <span className="tabular-nums">
            {'  '}
            {sel
              ? `score ${sel.nightScore}, ${plural(count(sel.date))}${sel.holidayName ? `, ${sel.holidayName}` : ''}`
              : 'Pick a night to see only its events'}
          </span>
        </p>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-[13px] font-medium text-white transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.14] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
          >
            All nights
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter by night"
        className="mt-3 grid h-14 items-end gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${nights.length}, minmax(0, 1fr))` }}
      >
        {nights.map((n, i) => {
          const on = n.date === selected;
          const label = `${i === 0 ? 'Tonight, ' : ''}${fmtDow(n.date)} ${fmtDay(n.date)}: demand ${n.nightScore}${
            n.topEvent ? `, ${n.topEvent}` : ''
          }`;
          return (
            <button
              key={n.date}
              type="button"
              aria-pressed={on}
              aria-label={label}
              title={label}
              onClick={() => onSelect(on ? null : n.date)}
              className="group flex h-full items-end rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span
                style={{ height: `${Math.max(12, Math.min(100, n.nightScore))}%` }}
                className={`w-full origin-bottom rounded-[3px] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-y-105 group-hover:opacity-100 motion-reduce:transition-none ${
                  BAR[band(n.nightScore)]
                } ${selected && !on ? 'opacity-35' : ''} ${on ? 'outline outline-2 outline-offset-2 outline-white' : ''}`}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-geist-mono text-[11px] tabular-nums text-white/50">
        <span>Tonight</span>
        <span>{fmtDay(nights[nights.length - 1].date)}</span>
      </div>
    </div>
  );
}

function AlertReading({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 shrink-0 text-white/70">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block font-geist-mono text-[12px] text-[#adc6ff]">{label}</span>
        <p className="mt-0.5 text-[14px] leading-relaxed text-white/80">{children}</p>
      </div>
    </div>
  );
}
