'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/ssr/MapTrifold';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight';
import { Bezel, PillButton } from './landing/Machined';
import { todayIn, noonUTC, toIsoDate, addDays, fmtDay, fmtDow, fmtDowDayYear, fmtWeekdayLong, fmtMonthYearLong } from '../../backend/lib/date';

/*
 * Demand calendar, on the Machined Instrument language.
 *
 * One month at a time, paged with previous / next and a Today jump. The
 * next-month button names the month and how many forecast nights it holds,
 * because a 21-night window usually crosses a month end and the second half
 * used to sit behind a bare arrow with nothing to say it was there. Arrow keys
 * page on their own when they step past the month's edge.
 *
 * Each night is pressable and opens a popover anchored to its cell, so the
 * grid keeps the full width. The popover answers what the cell can only hint
 * at: the suggested rate against its baseline, the demand score, any holiday,
 * and every event that night with how much it matters, how many people are
 * expected and how far away it is. Arrow keys move between nights (the
 * popover follows while open); Escape, the close button or a press outside
 * closes it.
 *
 * Cells use the demand chips' own fills (DESIGN.md → Chips), so a Major night
 * looks the same here as a Major event in the list above it.
 */

export interface CalendarEvent {
  id: string;
  name: string;
  venue: string;
  kind: string;
  attendance: number;
  score: number;
  tier: string;
  verdict: string;
  miles: number | null;
}

export interface CalendarNight {
  date: string;
  nightScore: number;
  holidayName?: string;
  topEvent?: string;
  /** Suggested standard-room rate for the night. */
  rate?: number;
  /** The day-of-week baseline the rate started from. */
  baseline?: number;
  events?: CalendarEvent[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/*
 * Tiers are the scoring engine's own thresholds, so a cell's weight means the
 * same thing the recommendation does.
 *
 * `fill` is the single source of truth, shared by the day cells, the legend
 * swatches and the chips in the night panel, so they can never disagree about
 * what a tier looks like. An earlier legend picked its own colours and
 * rendered one swatch white on white. `track` is the meter's colour on that fill.
 */
const TIERS = [
  { min: 70, label: 'Major', fill: 'bg-[#085ac0]', text: 'text-white', sub: 'text-white/75', track: 'bg-white/25' },
  { min: 40, label: 'Meaningful', fill: 'bg-[#e5eeff]', text: 'text-[#085ac0]', sub: 'text-[#085ac0]/80', track: 'bg-[#085ac0]/15' },
  { min: 15, label: 'Minor', fill: 'bg-[#1a1b20]/[0.08]', text: 'text-[#1a1b20]', sub: 'text-[#44474d]', track: 'bg-[#1a1b20]/10' },
  { min: 0, label: 'Quiet', fill: 'bg-[#0b1c30]/[0.035]', text: 'text-[#44474d]', sub: 'text-[#44474d]', track: 'bg-[#0b1c30]/[0.06]' },
] as const;

const tierFor = (score: number) => TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];

const KIND_LABEL: Record<string, string> = {
  convention: 'Conference',
  university: 'University',
  concert: 'Concert',
  sports: 'Sports',
  holiday: 'Holiday',
  other: 'Event',
};

const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';
/* Month navigation: white pills, as everything pressable is (DESIGN.md → Pill-Or-Panel). */
const NAV_PILL =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-white text-[13px] font-medium text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.1] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#f3f5fc] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/50 motion-reduce:transition-none';
const CHIP = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium';

/**
 * Property-local today that stays correct in a tab left open past midnight.
 *
 * Seeded from the server-rendered value so hydration matches exactly, then
 * corrected on the client. Two triggers, because one isn't enough:
 *  - a one-minute poll, which rolls the date over shortly after local midnight
 *  - visibility/focus, because timers are throttled or suspended entirely while
 *    a tab is hidden or the machine sleeps, which is the common case for a
 *    dashboard left open overnight
 *
 * Setting the same string is a no-op in React, so the poll costs nothing on
 * the 1,439 minutes a day when the date hasn't changed.
 */
function useLiveToday(serverToday: string, timeZone: string): string {
  const [today, setToday] = useState(serverToday);

  useEffect(() => {
    const sync = () => setToday((prev) => {
      const next = todayIn(timeZone);
      return next === prev ? prev : next;
    });

    sync(); // the server value may already be stale by the time this hydrates
    const timer = setInterval(sync, 60_000);
    const onWake = () => {
      if (!document.hidden) sync();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [timeZone]);

  return today;
}


export default function DemandCalendar({
  nights,
  today: serverToday,
  timeZone = 'America/Chicago',
  onShowOnMap,
}: {
  nights: CalendarNight[];
  /** Property-local today as rendered on the server; kept live on the client. */
  today: string;
  /** The property's IANA zone — the night being priced is its local night. */
  timeZone?: string;
  /** Filter the event map to this night and bring it into view. */
  onShowOnMap?: (date: string) => void;
}) {
  const today = useLiveToday(serverToday, timeZone);
  const byDate = useMemo(() => new Map(nights.map((n) => [n.date, n])), [nights]);
  const first = nights[0]?.date;
  const last = nights[nights.length - 1]?.date;

  const peakDate = useMemo(() => {
    const best = nights.reduce<CalendarNight | null>(
      (acc, n) => (!acc || n.nightScore > acc.nightScore ? n : acc),
      null,
    );
    return best && best.nightScore >= 15 ? best.date : null;
  }, [nights]);

  /* One weekday-aligned grid per month the window touches, paged like a wall
     calendar. Days of other months are blank; each month knows how many
     forecast nights it holds so the next-month button can say so. */
  const months = useMemo(() => {
    if (!first || !last) return [];
    const out: { key: string; label: string; short: string; cells: (string | null)[]; count: number }[] = [];
    const cursor = new Date(Date.UTC(noonUTC(first).getUTCFullYear(), noonUTC(first).getUTCMonth(), 1, 12));
    const end = noonUTC(last);
    while (cursor <= end) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth();
      const daysIn = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
      const cells: (string | null)[] = Array<string | null>(cursor.getUTCDay()).fill(null);
      for (let d = 1; d <= daysIn; d++) cells.push(toIsoDate(new Date(Date.UTC(y, m, d, 12))));
      while (cells.length % 7 !== 0) cells.push(null);
      out.push({
        key: `${y}-${m}`,
        label: fmtMonthYearLong(cursor),
        short: cursor.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        cells,
        count: cells.filter((d) => d != null && byDate.has(d)).length,
      });
      cursor.setUTCMonth(m + 1);
    }
    return out;
  }, [first, last, byDate]);

  const monthOf = (date: string) => months.findIndex((mo) => mo.cells.includes(date));
  const todayIdx = monthOf(today);

  /* Open on today's month when today is a forecast night, else on the month
     the window starts in. Testing grid membership instead would open a stale
     snapshot on a month of faded dates and hide every event before it. */
  const [monthIdx, setMonthIdx] = useState(() => (byDate.has(today) && todayIdx >= 0 ? todayIdx : 0));
  // Clamp rather than index blindly: `months` shrinks when the window does.
  const idx = Math.min(monthIdx, Math.max(0, months.length - 1));
  const month = months[idx];
  const prev = months[idx - 1];
  const next = months[idx + 1];

  /* Leading and trailing weeks with no forecast night (and not holding today)
     are left out, so a window starting late in a month doesn't open on three
     weeks of faded numbers. Only the ends are trimmed: no holes mid-grid. */
  const cells = useMemo(() => {
    if (!month) return [];
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < month.cells.length; i += 7) weeks.push(month.cells.slice(i, i + 7));
    const live = (w: (string | null)[]) => w.some((d) => d != null && (byDate.has(d) || d === today));
    const a = weeks.findIndex(live);
    const b = weeks.length - 1 - [...weeks].reverse().findIndex(live);
    return (a < 0 ? weeks : weeks.slice(a, b + 1)).flat();
  }, [month, byDate, today]);

  /** The roving focus target; the popover describes it while `open`. */
  const [selected, setSelected] = useState<string | null>(first ?? null);
  const [open, setOpen] = useState(false);
  /** Bumped on each open so the popover's entrance plays once per opening, not per night. */
  const [openKey, setOpenKey] = useState(0);
  // A selection that fell out of the window (it moved on overnight) snaps to its start.
  const sel = selected && byDate.has(selected) ? selected : (first ?? null);
  const night = sel ? byDate.get(sel) : undefined;
  /* The one cell Tab lands on: the selection when it is on this page, else
     the page's first forecast night, so the grid is always reachable. */
  const tabDate = sel && cells.includes(sel) ? sel : (cells.find((d) => d != null && byDate.has(d)) ?? null);

  /** Page to another month. The popover's cell is on the old page, so it closes. */
  const goMonth = (i: number) => {
    setMonthIdx(i);
    setOpen(false);
  };

  const refs = useRef(new Map<string, HTMLButtonElement>());
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; caret: number; above: boolean } | null>(null);

  const openOn = (date: string) => {
    setSelected(date);
    if (!open) setOpenKey((k) => k + 1);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus && sel) refs.current.get(sel)?.focus();
  };

  /* Anchor the popover to its cell: centred under it, clamped inside the
     calendar, flipped above when the viewport has no room below. Measured
     after render (it needs its own size), again on resize and on the grid's
     own sideways scroll on phones. */
  useLayoutEffect(() => {
    if (!open || !sel) {
      setPos(null);
      return;
    }
    const place = () => {
      const wrap = wrapRef.current;
      const cell = refs.current.get(sel);
      const pop = popRef.current;
      if (!wrap || !cell || !pop) return;
      const w = wrap.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const cx = c.left - w.left + c.width / 2;
      const left = Math.min(Math.max(cx - pop.offsetWidth / 2, 0), w.width - pop.offsetWidth);
      const above = window.innerHeight - c.bottom < pop.offsetHeight + 24 && c.top > pop.offsetHeight + 24;
      setPos({
        left,
        top: above ? c.top - w.top - pop.offsetHeight - 12 : c.bottom - w.top + 12,
        caret: Math.min(Math.max(cx - left, 20), pop.offsetWidth - 20),
        above,
      });
    };
    place();
    const ro = new ResizeObserver(place);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (popRef.current) ro.observe(popRef.current);
    const scroller = scrollRef.current;
    scroller?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      scroller?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [open, sel]);

  // A press anywhere outside the popover and the grid closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || gridRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  /** Select and focus a night, paging to its month first if it is on another. */
  const move = (to: string) => {
    if (!byDate.has(to)) return;
    setSelected(to);
    const mi = monthOf(to);
    if (mi >= 0 && mi !== idx) setMonthIdx(mi);
    // After the page renders, so the cell exists when it is focused.
    requestAnimationFrame(() => refs.current.get(to)?.focus());
  };

  const goToday = () => {
    if (todayIdx < 0) return;
    goMonth(todayIdx);
    if (byDate.has(today)) {
      setSelected(today);
      requestAnimationFrame(() => refs.current.get(today)?.focus());
    }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!sel || !first || !last) return;
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
      return;
    }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step != null) {
      e.preventDefault();
      move(addDays(sel, step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(first);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(last);
    }
  };

  const todayOutside = first != null && !byDate.has(today);

  return (
    // No overflow-hidden on the core: a popover on the bottom row may hang past it.
    <Bezel>
      <div className="flex flex-col gap-5 p-6 md:px-8 md:pt-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-tight">Demand calendar</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[#44474d]">
            {first && last ? (
              <>
                <span className="tabular-nums">{nights.length}</span> forecast nights, {fmtDay(first)} to {fmtDay(last)}.
                Today is <span className="font-medium text-[#1a1b20]">{fmtDowDayYear(today)}</span>, property time.
              </>
            ) : (
              'No forecast nights yet.'
            )}
          </p>
        </div>

        {month && (
          <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => prev && goMonth(idx - 1)}
              disabled={!prev}
              aria-label={prev ? `Previous month, ${prev.label}` : 'No earlier month in the forecast window'}
              title={prev ? `Back to ${prev.label}` : 'No earlier month in the forecast window'}
              className={`${NAV_PILL} ${prev ? 'pl-2.5 pr-3.5' : 'w-9 justify-center'}`}
            >
              <CaretLeftIcon weight="light" aria-hidden className="h-4 w-4" />
              {prev && <span>{prev.short}</span>}
            </button>
            <span aria-live="polite" className="min-w-[9.5rem] text-center text-[15px] font-medium tracking-tight">
              {month.label}
            </span>
            <button
              type="button"
              onClick={() => next && goMonth(idx + 1)}
              disabled={!next}
              aria-label={next ? `Next month, ${next.label}: ${next.count} forecast nights` : 'No later month in the forecast window'}
              title={next ? `${next.count} forecast night${next.count === 1 ? '' : 's'} in ${next.label}` : 'No later month in the forecast window'}
              className={`${NAV_PILL} ${next ? 'pl-3.5 pr-2.5' : 'w-9 justify-center'}`}
            >
              {next && (
                <span>
                  {next.short}
                  <span className="ml-1.5 font-geist-mono text-[12px] tabular-nums text-[#085ac0]">{next.count}</span>
                </span>
              )}
              <CaretRightIcon weight="light" aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              disabled={todayIdx < 0 || (todayIdx === idx && sel === today)}
              title={todayIdx < 0 ? 'Today is outside the forecast window' : `Jump to ${fmtDowDayYear(today)}`}
              className={`${NAV_PILL} px-4`}
            >
              Today
            </button>
          </nav>
        )}
      </div>

      {!first ? (
        <p className="mx-6 mb-6 rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d] md:mx-8 md:mb-8">
          No forecast nights available. They appear after the next collection run.
        </p>
      ) : (
        <div ref={wrapRef} className="relative px-6 pb-6 md:px-8 md:pb-8">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {TIERS.slice().reverse().map((t) => (
              <span key={t.label} className="inline-flex items-center gap-2 text-[13px] text-[#44474d]">
                {/* Swatch shares the tier fill with the day cells, see TIERS. */}
                <span aria-hidden className={`h-3 w-3 rounded-[4px] ring-1 ring-inset ring-[#0b1c30]/[0.06] ${t.fill}`} />
                {t.label}
              </span>
            ))}
          </div>
          {/* The grid scrolls sideways on its own below 560px rather than
              crushing seven columns onto a phone. */}
          <div ref={scrollRef} className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center font-geist-mono text-[12px] text-[#44474d]">
                    {d}
                  </div>
                ))}
              </div>

              <div
                ref={gridRef}
                role="group"
                aria-label="Forecast nights. Arrow keys move between nights, Enter opens one."
                onKeyDown={onKey}
                className="grid grid-cols-7 gap-1.5"
              >
                {cells.map((date, i) => {
                  // A day of the neighbouring month: blank, as on a wall calendar.
                  if (!date) return <div key={`pad-${month?.key}-${i}`} aria-hidden className="min-h-[88px]" />;
                  const n = byDate.get(date);
                  const dayLabel = String(noonUTC(date).getUTCDate());
                  const isToday = date === today;
                  const todayRing = isToday ? 'ring-2 ring-inset ring-[#085ac0]' : '';

                  // Outside the collected window: a real date, no data.
                  if (!n) {
                    return (
                      <div
                        key={date}
                        className={`min-h-[88px] rounded-[0.5rem] p-2.5 ${todayRing}`}
                        title={isToday ? `${date}, today, outside the forecast window` : `${date}, outside the forecast window`}
                      >
                        <span
                          className={`font-geist-mono text-[13px] tabular-nums ${
                            isToday ? 'font-medium text-[#085ac0]' : 'text-[#44474d]/45'
                          }`}
                        >
                          {dayLabel}
                        </span>
                        {isToday && <span className="mt-1 block text-[11px] font-medium text-[#085ac0]">Today</span>}
                      </div>
                    );
                  }

                  const tier = tierFor(n.nightScore);
                  const on = date === sel;
                  const shown = on && open;
                  const count = n.events?.length ?? 0;
                  return (
                    <button
                      key={date}
                      ref={(node) => {
                        if (node) refs.current.set(date, node);
                        else refs.current.delete(date);
                      }}
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={shown}
                      aria-controls={shown ? 'night-popover' : undefined}
                      tabIndex={date === tabDate ? 0 : -1}
                      onClick={() => (shown ? close(false) : openOn(date))}
                      aria-label={`${fmtWeekdayLong(date)}${isToday ? ', today' : ''}. ${tier.label} demand, score ${n.nightScore}${
                        n.rate != null ? `, suggested $${n.rate}` : ''
                      }${count ? `, ${count} event${count === 1 ? '' : 's'}` : ''}`}
                      className={`relative flex min-h-[88px] flex-col rounded-[0.5rem] p-2.5 text-left transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:shadow-[0_10px_20px_-12px_rgba(11,28,48,0.45)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/60 focus-visible:ring-offset-2 motion-reduce:transition-none ${
                        tier.fill
                      } ${tier.text} ${todayRing} ${shown ? 'outline outline-2 outline-offset-2 outline-[#0b1c30]' : ''}`}
                    >
                      <span className="flex items-baseline justify-between gap-1">
                        <span className="font-geist-mono text-[13px] font-medium tabular-nums">{dayLabel}</span>
                        {n.rate != null && (
                          <span className={`font-geist-mono text-[12px] tabular-nums ${tier.sub}`}>${n.rate}</span>
                        )}
                      </span>

                      {n.topEvent && (
                        <span className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-snug">{n.topEvent}</span>
                      )}
                      {date === peakDate && <span className={`mt-1 text-[11px] ${tier.sub}`}>Peak night</span>}

                      {/* Intensity meter, present on every night so a quiet
                          one reads as measured-and-low, not as missing. */}
                      <span aria-hidden className={`mt-auto block h-1 w-full overflow-hidden rounded-full ${tier.track}`}>
                        <span
                          className="block h-full rounded-full bg-current opacity-70"
                          style={{ width: `${Math.max(3, Math.min(100, n.nightScore))}%` }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {open && night && (
            <div
              key={openKey}
              ref={popRef}
              id="night-popover"
              role="dialog"
              aria-label={`${fmtWeekdayLong(night.date)} details`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  close(true);
                }
              }}
              style={
                pos
                  ? { left: pos.left, top: pos.top, transformOrigin: `${pos.caret}px ${pos.above ? '100%' : '0'}` }
                  : { left: 0, top: 0, visibility: 'hidden' }
              }
              className="night-popover absolute z-20 w-[min(22rem,100%)]"
            >
              {/* Caret pointing at the cell. */}
              {pos && (
                <span
                  aria-hidden
                  style={{ left: pos.caret - 6 }}
                  className={`absolute h-3 w-3 rotate-45 bg-white ${pos.above ? '-bottom-1.5' : '-top-1.5'}`}
                />
              )}
              <NightDetail
                night={night}
                isTonight={night.date === first}
                onClose={() => close(true)}
                onShowOnMap={
                  onShowOnMap
                    ? (d) => {
                        setOpen(false);
                        onShowOnMap(d);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      <p className="border-t border-[#0b1c30]/[0.06] px-6 py-4 text-[13px] leading-relaxed text-[#44474d] md:px-8">
        Each night shows its suggested standard rate; pick one for its events. Faded dates are outside the forecast
        window. Today is ringed in cobalt{todayOutside ? ', and it sits outside the window, so the collector is behind' : ''}.
        Dates are the property&apos;s local day ({timeZone}), not your browser&apos;s.
      </p>
    </Bezel>
  );
}

/* ---- night detail ---- */

function NightDetail({
  night,
  isTonight,
  onClose,
  onShowOnMap,
}: {
  night: CalendarNight;
  isTonight: boolean;
  onClose: () => void;
  onShowOnMap?: (date: string) => void;
}) {
  const tier = tierFor(night.nightScore);
  const events = night.events ?? [];
  const vsBase =
    night.rate != null && night.baseline ? Math.round(((night.rate - night.baseline) / night.baseline) * 100) : null;
  const expected = events.filter((e) => e.tier !== 'too-small').reduce((sum, e) => sum + e.attendance, 0);

  return (
    <div
      aria-live="polite"
      className="relative flex min-w-0 flex-col rounded-[1.25rem] bg-white p-5 shadow-[0_24px_48px_-20px_rgba(11,28,48,0.45)] ring-1 ring-[#0b1c30]/[0.08]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={MONO_LABEL}>{isTonight ? 'Tonight' : fmtDow(night.date)}</span>
          <h3 className="mt-0.5 text-balance text-[20px] font-semibold leading-tight tracking-tight">
            {fmtWeekdayLong(night.date)}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#44474d] transition-[background-color,transform] duration-200 hover:bg-[#0b1c30]/[0.06] hover:text-[#1a1b20] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/50 motion-reduce:transition-none"
        >
          <XIcon weight="light" aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className={MONO_LABEL}>Suggested rate</dt>
          <dd className="mt-1 text-[32px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0]">
            {night.rate != null ? `$${night.rate}` : <span className="text-[15px] font-normal tracking-normal text-[#44474d]">Not set</span>}
          </dd>
          {vsBase != null && (
            <dd className="mt-1.5 font-geist-mono text-[12px] tabular-nums text-[#44474d]">
              {vsBase === 0 ? 'At' : `${vsBase > 0 ? '+' : ''}${vsBase}% vs`} the ${night.baseline} baseline
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className={MONO_LABEL}>Demand</dt>
          <dd className="mt-1 text-[32px] font-semibold leading-none tracking-tighter tabular-nums">{night.nightScore}</dd>
          <dd className="mt-1.5">
            <span className={`${CHIP} ${tier.fill} ${tier.text}`}>{tier.label}</span>
          </dd>
        </div>
      </dl>

      {night.holidayName && (
        <p className="mt-4 rounded-[0.75rem] bg-[#e5eeff] px-3.5 py-2.5 text-[13.5px]">
          <span className="font-medium">{night.holidayName}</span>
          <span className="text-[#44474d]"> holiday is in effect this night.</span>
        </p>
      )}

      <div className="my-5 h-px bg-[#0b1c30]/[0.08]" />

      <div className="flex items-baseline justify-between gap-3">
        <span className={MONO_LABEL}>
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
        {expected > 0 && (
          <span className={`${MONO_LABEL} tabular-nums`}>{expected.toLocaleString()} expected in total</span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-[#44474d]">
          {night.holidayName
            ? 'No events, only the holiday moves this night.'
            : 'No events this night. The rate follows the day-of-week baseline.'}
        </p>
      ) : (
        <ul className="-mr-2 mt-3 max-h-[18rem] space-y-2.5 overflow-y-auto overscroll-contain pr-2">
          {events.map((e) => {
            const small = e.tier === 'too-small';
            const t = tierFor(e.score);
            return (
              <li key={e.id} className={`rounded-[0.75rem] bg-[#0b1c30]/[0.035] p-3.5 ${small ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[14.5px] font-medium leading-snug">{e.name}</p>
                  <span className={`${CHIP} ${small ? 'bg-[#0b1c30]/[0.05] text-[#44474d]' : `${t.fill} ${t.text}`}`}>
                    {small ? 'Too small to matter' : t.label}
                  </span>
                </div>
                <p className="mt-1.5 font-geist-mono text-[13px] tabular-nums">
                  {e.attendance.toLocaleString()} <span className="text-[#44474d]">expected</span>
                </p>
                <p className="mt-0.5 text-pretty text-[13px] text-[#44474d]">
                  {KIND_LABEL[e.kind] ?? 'Event'} at {e.venue}
                  {e.miles != null ? `, ${e.miles < 10 ? e.miles.toFixed(1) : Math.round(e.miles)} mi away` : ''}
                </p>
                <p className="mt-2 text-pretty text-[13px] leading-relaxed text-[#44474d]">{e.verdict}</p>
              </li>
            );
          })}
        </ul>
      )}

      {onShowOnMap && events.some((e) => e.miles != null) && (
        <div className="mt-5">
          <PillButton
            variant="secondary"
            size="sm"
            onClick={() => onShowOnMap(night.date)}
            icon={<MapTrifoldIcon weight="light" className="h-3.5 w-3.5" />}
          >
            Show on map
          </PillButton>
        </div>
      )}
    </div>
  );
}
