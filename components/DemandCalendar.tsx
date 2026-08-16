'use client';
import { useEffect, useMemo, useState } from 'react';
import { todayIn } from '../lib/tz';

/*
 * Demand calendar — a real month grid, in the app's own language.
 *
 * The supplied mock rendered this as a dark slab, which read as a foreign
 * object in an otherwise all-light app; it also wasn't a calendar, just a
 * 21-cell strip that ran off the end of the forecast window with no month
 * structure. This renders one proper grid per month the window touches, so
 * month boundaries, weekday alignment and out-of-window days are all honest.
 *
 * Intensity uses the same cobalt ramp as the competitor grid, so "busy" looks
 * the same on both pages rather than each inventing its own scale.
 */

export interface CalendarNight {
  date: string;
  nightScore: number;
  topEvent?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/*
 * Tiers are the scoring engine's own thresholds, so a cell's weight means the
 * same thing the recommendation does.
 *
 * `fill` is the single source of truth, shared by the day cells and the legend
 * swatches, so the two can never disagree about what a tier looks like. Two
 * bugs came out of getting this wrong:
 *
 *   1. A separate `dot` colour for the legend, picked to sit on a coloured
 *      cell, rendered white-on-white in the legend — 1.00 contrast, invisible.
 *   2. Reusing the cell's own `border` on the swatch left Minor at 1.37, since
 *      a 20%-alpha outline that reads fine around a 76px cell disappears
 *      around a 12px chip.
 *
 * Hence: fill is shared, border is per-context.
 */
const TIERS = [
  { min: 70, label: 'Major', fill: 'bg-accent', text: 'text-white', border: 'border-accent-deep' },
  { min: 40, label: 'Meaningful', fill: 'bg-accent/25', text: 'text-ink', border: 'border-accent/40' },
  { min: 15, label: 'Minor', fill: 'bg-accent/10', text: 'text-ink', border: 'border-accent/20' },
  { min: 0, label: 'Quiet', fill: 'bg-card', text: 'text-muted', border: 'border-line' },
] as const;

type Tier = (typeof TIERS)[number];

/** Day-cell appearance: the tier's own fill, text and outline. */
const cellClass = (t: Tier) => `${t.fill} ${t.text} ${t.border}`;
/** Legend chip: same fill, but a hairline that stays legible at 12px. */
const swatchClass = (t: Tier) => `${t.fill} border-line`;

const tierFor = (score: number) => TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];

const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

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
}: {
  nights: CalendarNight[];
  /** Property-local today as rendered on the server; kept live on the client. */
  today: string;
  /** The property's IANA zone — the night being priced is its local night. */
  timeZone?: string;
}) {
  const today = useLiveToday(serverToday, timeZone);
  const byDate = useMemo(() => new Map(nights.map((n) => [n.date, n])), [nights]);

  const peakDate = useMemo(() => {
    const best = nights.reduce<CalendarNight | null>(
      (acc, n) => (!acc || n.nightScore > acc.nightScore ? n : acc),
      null,
    );
    return best && best.nightScore >= 15 ? best.date : null;
  }, [nights]);

  /* One full month grid per month the window touches, padded to weekday
     alignment. Days outside the forecast window render inactive rather than
     being omitted — a calendar with holes isn't a calendar. */
  const months = useMemo(() => {
    if (nights.length === 0) return [];
    const first = utc(nights[0].date);
    const last = utc(nights[nights.length - 1].date);

    const out: { key: string; label: string; cells: (string | null)[] }[] = [];
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1, 12));

    while (cursor <= last) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const daysIn = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
      const lead = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();

      const cells: (string | null)[] = Array<string | null>(lead).fill(null);
      for (let d = 1; d <= daysIn; d++) cells.push(iso(new Date(Date.UTC(year, month, d, 12))));
      while (cells.length % 7 !== 0) cells.push(null);

      out.push({
        key: `${year}-${month}`,
        label: new Date(Date.UTC(year, month, 1, 12)).toLocaleDateString('en-US', {
          month: 'long', year: 'numeric', timeZone: 'UTC',
        }),
        cells,
      });
      cursor.setUTCMonth(month + 1);
    }
    return out;
  }, [nights]);

  /*
   * Open on today's month only when today is an actual FORECAST night, else on
   * the month the window starts in.
   *
   * Testing grid membership instead of window membership was wrong: every real
   * date appears in some month's cells, so a stale snapshot (window ending
   * before today) opened on today's month — which was almost entirely
   * out-of-window dashes, hiding every event in the month before it.
   */
  const [monthIdx, setMonthIdx] = useState(() => {
    if (!byDate.has(today)) return 0;
    const hit = months.findIndex((m) => m.cells.includes(today));
    return hit >= 0 ? hit : 0;
  });

  // Clamp rather than index blindly: `months` shrinks when the window does.
  const idx = Math.min(monthIdx, Math.max(0, months.length - 1));
  const month = months[idx];
  const canPrev = idx > 0;
  const canNext = idx < months.length - 1;

  // Which rendered month holds today, if any — drives the "Today" jump.
  const todayIdx = useMemo(() => months.findIndex((m) => m.cells.includes(today)), [months, today]);
  const todayLabel = utc(today).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const tracked = nights.length;
  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:border-line disabled:text-muted/40 disabled:hover:border-line';

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-line bg-paper px-lg py-md">
        <div>
          <h3 className="font-headline-md text-headline-md text-ink">Demand Calendar</h3>
          <p className="mt-0.5 font-body-md text-body-md text-muted">
            {tracked} forecast night{tracked === 1 ? '' : 's'} · today is{' '}
            <span className="font-semibold text-ink">{todayLabel}</span>{' '}
            <span className="text-muted">(property time)</span>
          </p>
        </div>

        {month && (
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => setMonthIdx(idx - 1)}
              disabled={!canPrev}
              aria-label="Previous month"
              title={canPrev ? `Back to ${months[idx - 1].label}` : 'No earlier month in the forecast window'}
              className={navBtn}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>chevron_left</span>
            </button>
            <span className="min-w-[132px] text-center font-headline-md text-[15px] text-ink">
              {month.label}
            </span>
            {todayIdx >= 0 && (
              <button
                type="button"
                onClick={() => setMonthIdx(todayIdx)}
                disabled={todayIdx === idx}
                title={`Jump to ${todayLabel}`}
                className="rounded-lg border border-line px-sm py-1 font-label-md text-label-md text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:border-line disabled:text-muted/40 disabled:hover:border-line"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => setMonthIdx(idx + 1)}
              disabled={!canNext}
              aria-label="Next month"
              title={canNext ? `Forward to ${months[idx + 1].label}` : 'No later month in the forecast window'}
              className={navBtn}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>chevron_right</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-sm">
          {TIERS.slice().reverse().map((t) => (
            <span
              key={t.label}
              className="flex items-center gap-xs rounded-full border border-line bg-card px-sm py-1"
            >
              {/* Swatch shares the tier fill with the day cells — see TIERS. */}
              <span className={`h-3 w-3 rounded-sm border ${swatchClass(t)}`} />
              <span className="font-label-md text-label-md text-muted">{t.label}</span>
            </span>
          ))}
        </div>
      </div>

      {!month ? (
        <p className="p-lg font-body-md text-body-md text-muted">No forecast nights available.</p>
      ) : (
        <div className="p-lg">
          <section key={month.key}>
              <div className="mb-xs grid grid-cols-7 gap-xs">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center font-label-md text-label-md uppercase text-muted">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-xs">
                {month.cells.map((date, i) => {
                  if (!date) return <div key={`pad-${month.key}-${i}`} className="min-h-[76px] rounded-lg" />;

                  const night = byDate.get(date);
                  const day = utc(date).getUTCDate();
                  /* Computed BEFORE the out-of-window branch. It used to live
                     after it, so whenever the collector fell behind and today
                     sat outside the window, today went unmarked entirely — the
                     calendar showed no "today" at all. */
                  const isToday = date === today;

                  // Outside the collected window — a real date, no data.
                  if (!night) {
                    return (
                      <div
                        key={date}
                        className={`min-h-[76px] rounded-lg border border-dashed p-sm ${
                          isToday ? 'border-accent bg-accent/5 ring-2 ring-inset ring-accent' : 'border-line/60'
                        }`}
                        title={
                          isToday
                            ? `${date} — today · outside the forecast window`
                            : `${date} — outside the forecast window`
                        }
                      >
                        <span
                          className={`font-data-mono text-sm tabular-nums ${
                            isToday ? 'font-bold text-accent' : 'text-muted/50'
                          }`}
                        >
                          {day}
                        </span>
                        {isToday && (
                          <span className="mt-1 block font-label-md text-[9px] font-bold uppercase text-accent">
                            Today
                          </span>
                        )}
                      </div>
                    );
                  }

                  const tier = tierFor(night.nightScore);
                  const isPeak = date === peakDate;

                  return (
                    <div
                      key={date}
                      title={`${date} — demand score ${night.nightScore}${night.topEvent ? ` · ${night.topEvent}` : ''}`}
                      className={`group relative flex min-h-[76px] cursor-default flex-col rounded-lg border p-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(11,28,48,0.1)] ${cellClass(tier)} ${
                        isToday ? 'ring-2 ring-inset ring-accent' : ''
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-data-mono text-sm font-bold tabular-nums">{day}</span>
                        <span className="font-data-mono text-[10px] tabular-nums opacity-70">
                          {night.nightScore}
                        </span>
                      </div>

                      {night.topEvent && (
                        <span className="mt-1 line-clamp-2 font-label-md text-[9px] font-bold uppercase leading-tight">
                          {night.topEvent}
                        </span>
                      )}

                      {/* Intensity track — present on every night so a quiet
                          one reads as measured-and-low, not as missing. */}
                      <div className="mt-auto h-1 w-full overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="h-full rounded-full bg-current opacity-70"
                          style={{ width: `${Math.max(3, Math.min(100, night.nightScore))}%` }}
                        />
                      </div>

                      {isPeak && (
                        <span
                          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#029768] ring-2 ring-card"
                          title="Highest demand in this window"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
          </section>
        </div>
      )}

      <p className="border-t border-line px-lg py-md text-xs text-muted">
        Dashed days fall outside the collected forecast window. Today is ringed in blue — including when it
        falls outside the window, which means the collector is behind. The green dot marks the highest-demand
        night. Dates are the property&apos;s local day (America/Chicago), not your browser&apos;s.
      </p>
    </div>
  );
}
