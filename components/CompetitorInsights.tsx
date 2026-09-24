'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr/DownloadSimple';
import { ChartLineIcon } from '@phosphor-icons/react/dist/ssr/ChartLine';
import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr/CaretDown';
import { ArrowUpIcon } from '@phosphor-icons/react/dist/ssr/ArrowUp';
import { ArrowDownIcon } from '@phosphor-icons/react/dist/ssr/ArrowDown';
import { MinusIcon } from '@phosphor-icons/react/dist/ssr/Minus';
import { useCanWrite } from './RoleProvider';
import { Bezel, PillButton, SPRING } from './landing/Machined';
import { fmtDay, fmtDow } from '../lib/date';

/*
 * Competitor Insights, on the Machined Instrument language (DESIGN.md).
 *
 * Layout is the dashboard's bento: a 7/5 split over full-width rows.
 *
 *   - Market position (light core). The suggested rate is the one cobalt
 *     figure; under it, a position strip plots every competitor's price for
 *     the night with your rate, the median and the suggestion on the same
 *     axis, so "where do I land" is read, not computed.
 *   - Tonight's prices (navy core), because every figure in it was scraped.
 *   - Price history, beside the parity panel when the page passes one in.
 *   - The watchlist grid, with search-to-add in the same enclosure.
 *
 * Every figure comes from collected data. Where a series genuinely does not
 * exist yet the chart draws nothing and says so, rather than inventing a
 * plausible line: a fabricated competitor trend is the one thing that would
 * make this page actively dangerous to price against.
 */

export interface CompsetNight {
  date: string;
  entries: { name: string; price: number }[];
  median: number | null;
  /** Our recommended standard rate for that night. */
  recommended: number;
}

export interface HistoryPoint {
  date: string;
  recommended: number;
  compsetMedian: number | null;
}

interface Suggestion {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  distanceMi?: number;
}

interface Props {
  propertyId: string;
  propertyName: string;
  nights: CompsetNight[];
  history: HistoryPoint[];
  /** Owner-entered / scraped rate for the current night, if known. */
  yourRate: number | null;
  /** Watchlist names as of render: the grid's row source. */
  initialWatchlist: string[];
  isDemo: boolean;
  /** The parity panel, rendered by the page. Null when no channel is tracked. */
  parity?: ReactNode;
}

export const MAX_HOTELS = 25;

const money = (n: number) => `$${n}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n)}`;
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};

const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';
const DIVIDER = 'h-px bg-[#0b1c30]/[0.06]';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const CHIP = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium';
const QUIET = 'bg-[#0b1c30]/[0.05] text-[#44474d]';

/* Price level across the whole grid, so a dot means the same thing in every
   row and column. Terciles rather than fixed thresholds: what counts as a
   high rate is relative to this comp set, not an absolute dollar figure. */
const LEVELS = [
  { label: 'Low', dot: 'bg-[#84f9c3]' },
  { label: 'Mid', dot: 'bg-[#adc6ff]' },
  { label: 'High', dot: 'bg-[#f29a8e]' },
] as const;

function levelDot(price: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (price - min) / (max - min);
  return LEVELS[t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2].dot;
}

export default function CompetitorInsights({
  propertyId, propertyName, nights, history, yourRate, initialWatchlist, isDemo, parity,
}: Props) {
  const [dateFrom, setDateFrom] = useState(nights[0]?.date ?? '');

  // --- watchlist editing ---
  const canWrite = useCanWrite();
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  /** Highlighted suggestion for arrow-key navigation; -1 is none. */
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tracked = watchlist.length;
  const full = tracked >= MAX_HOTELS;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`);
    if (res.ok) {
      const { hotels } = (await res.json()) as { hotels: { name: string }[] };
      setWatchlist(hotels.map((h) => h.name));
    }
  }, [propertyId]);

  useEffect(() => {
    // Cancel any in-flight suggestion request when unmounting.
    return () => searchAbort.current?.abort();
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    setNotice(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      setSearching(true);
      try {
        const res = await fetch(
          `/api/hotel-search?propertyId=${propertyId}&q=${encodeURIComponent(value.trim())}`,
          { signal: ctrl.signal },
        );
        if (res.ok) {
          setSuggestions(((await res.json()) as { results: Suggestion[] }).results);
          setActive(-1);
          setOpen(true);
        }
      } catch {
        /* aborted or offline: keep whatever we had */
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  /*
   * Runs a watchlist change with the controls locked, and always unlocks them.
   * A dropped connection used to leave `busy` set, disabling search and Add
   * until the page was reloaded.
   */
  async function mutate(work: () => Promise<void>, offline: string) {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } catch {
      setNotice({ text: offline, tone: 'warn' });
    }
    // Reread even after a failure, and separately: a refresh that fails must
    // not be reported as the change itself failing.
    await refresh().catch(() => {});
    setBusy(false);
  }

  // Follow-up calls whose failure must not undo a change that already saved.
  const settle = (url: string) =>
    fetch(url, { method: 'POST' }).then((r) => r.ok, () => false);

  function addHotel(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
    setQuery('');
    return mutate(async () => {
      const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, lat: s.lat, lng: s.lng, address: s.address }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; located?: boolean };
      if (!res.ok) {
        setNotice({ text: json.error ?? 'Could not add that hotel.', tone: 'warn' });
        return;
      }
      // A new hotel has no harvested prices yet, so try to kick off a real run.
      const kicked = await settle('/api/collect-now');
      setNotice({
        tone: 'ok',
        text:
          `Added ${s.name}.${json.located === false ? ' The geocoder could not place it, but prices still collect.' : ''}` +
          (kicked
            ? ' A collection run has started, so prices should appear in about 10 minutes.'
            : ' Prices appear after the next scheduled run.'),
      });
    }, `Could not reach the server, so ${s.name} was not added. Check your connection and try again.`);
  }

  function removeHotel(name: string) {
    return mutate(async () => {
      const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice({ text: json.error ?? 'Could not remove that hotel.', tone: 'warn' });
        return;
      }
      // Removal only refilters already-collected data, so it applies immediately.
      const applied = await settle(`/api/recompute?propertyId=${propertyId}`);
      setNotice({ tone: 'ok', text: `Removed ${name}.${applied ? ' Applied to the current data.' : ''}` });
    }, `Could not reach the server, so ${name} is still tracked. Check your connection and try again.`);
  }

  const visibleNights = useMemo(
    () => nights.filter((n) => !dateFrom || n.date >= dateFrom),
    [nights, dateFrom],
  );

  /*
   * One row per watchlist hotel.
   *
   * The join matters: matchCompset() keeps the BOOKING-SITE name and merely
   * filters it by substring against the watchlist, so the same hotel is
   * "Baymont" on the watchlist and "Baymont by Wyndham" in the collected
   * entries. Keying rows on the raw strings listed each hotel twice, once
   * with prices and once empty. Matching on the same substring rule the
   * collector uses keeps one row per hotel, labelled with the fuller name.
   */
  const hotels = useMemo(() => {
    const matches = (entryName: string, watchName: string) =>
      entryName.toLowerCase().includes(watchName.toLowerCase());

    const rows = watchlist.map((watchName) => {
      const perNight = visibleNights.map(
        (n) => n.entries.find((e) => matches(e.name, watchName)) ?? null,
      );
      const found = perNight.filter((e): e is { name: string; price: number } => e != null);
      const prices = found.map((e) => e.price);
      return {
        key: watchName,
        label: found[0]?.name ?? watchName,
        perNight,
        avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        latest: found[0]?.price ?? null,
      };
    });

    // Anything priced that no watchlist name claims. Shouldn't normally
    // happen, but collected data must never be silently dropped.
    const claimed = (name: string) => watchlist.some((w) => matches(name, w));
    const orphanNames = [
      ...new Set(visibleNights.flatMap((n) => n.entries.filter((e) => !claimed(e.name)).map((e) => e.name))),
    ];
    for (const name of orphanNames) {
      const perNight = visibleNights.map((n) => n.entries.find((e) => e.name === name) ?? null);
      const prices = perNight.filter((e) => e != null).map((e) => e!.price);
      rows.push({
        key: name,
        label: name,
        perNight,
        avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        latest: prices[0] ?? null,
      });
    }

    // Priced hotels first, most expensive down; unpriced names alphabetical.
    return rows.sort((a, b) => {
      if (a.avg == null && b.avg == null) return a.label.localeCompare(b.label);
      if (a.avg == null) return 1;
      if (b.avg == null) return -1;
      return b.avg - a.avg;
    });
  }, [watchlist, visibleNights]);

  const tonight = visibleNights[0];
  const median = tonight?.median ?? null;
  const priceIndex = median != null && yourRate != null ? (yourRate / median) * 100 : null;

  // Tonight's scraped prices, dearest first, for the navy panel.
  const pulse = useMemo(
    () => [...(tonight?.entries ?? [])].sort((a, b) => b.price - a.price),
    [tonight],
  );
  const PULSE_SHOWN = 8;

  // Rank among the comp set on the nearest night: 1 = most expensive.
  const rank = useMemo(() => {
    if (!tonight || yourRate == null || tonight.entries.length === 0) return null;
    const all = [...tonight.entries.map((e) => e.price), yourRate].sort((a, b) => b - a);
    return { position: all.indexOf(yourRate) + 1, total: all.length };
  }, [tonight, yourRate]);

  // Chart series: only points we actually recorded.
  const chart = useMemo(() => {
    const pts = [...history].sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) return null;
    const mine = pts.map((p) => p.recommended);
    const comp = pts.map((p) => p.compsetMedian).filter((v): v is number => v != null);
    const all = [...mine, ...comp];
    const lo = Math.floor(Math.min(...all) / 10) * 10;
    const hi = Math.ceil(Math.max(...all) / 10) * 10;
    const span = hi - lo || 1;
    const x = (i: number) => (i / (pts.length - 1)) * 100;
    const y = (v: number) => 100 - ((v - lo) / span) * 100;
    const line = (sel: (p: HistoryPoint) => number | null) =>
      pts
        .map((p, i) => ({ i, v: sel(p) }))
        .filter((d): d is { i: number; v: number } => d.v != null)
        .map((d) => `${x(d.i)},${y(d.v)}`)
        .join(' ');
    return {
      pts,
      mineLine: line((p) => p.recommended),
      compLine: line((p) => p.compsetMedian),
      compPoints: comp.length,
      ticks: [hi, lo + span * 0.75, lo + span * 0.5, lo + span * 0.25, lo].map(Math.round),
    };
  }, [history]);

  // Heat scale spans the whole visible grid, our own rates included.
  const { gridMin, gridMax } = useMemo(() => {
    const all = visibleNights.flatMap((n) => [...n.entries.map((e) => e.price), n.recommended]);
    return all.length
      ? { gridMin: Math.min(...all), gridMax: Math.max(...all) }
      : { gridMin: 0, gridMax: 1 };
  }, [visibleNights]);

  // The reading under the position strip. Real conditions only, in priority order.
  const insight = useMemo(() => {
    if (!tonight) return null;
    const day = fmtDay(tonight.date);
    if (median != null && yourRate != null && tonight.recommended > yourRate) {
      return `Your rate is ${money(yourRate)} and the suggestion for ${day} is ${money(tonight.recommended)}, so there is ${money(tonight.recommended - yourRate)} of headroom. The comp set median is ${money(median)}.`;
    }
    if (median != null && yourRate != null && yourRate > tonight.recommended) {
      return `Your rate of ${money(yourRate)} is ${money(yourRate - tonight.recommended)} above the suggestion for ${day}. The comp set median is ${money(median)}${yourRate > median ? `, so you are ${money(yourRate - median)} above the market too` : ''}.`;
    }
    if (median != null && tonight.recommended > median) {
      return `The suggestion for ${day} is ${money(tonight.recommended - median)} above the comp set median. Demand supports holding above the market.`;
    }
    if (median != null) {
      return `The suggestion for ${day} sits at or below the comp set median. It is a quiet night, so the comp set bound is doing the work.`;
    }
    return `No competitor prices came back for ${day}, so the comp set bound was skipped rather than estimated.`;
  }, [tonight, median, yourRate]);

  function exportCsv() {
    const header = ['Hotel', ...visibleNights.map((n) => n.date)];
    const rows = [
      [propertyName, ...visibleNights.map((n) => String(n.recommended))],
      ...hotels.map((h) => [h.label, ...h.perNight.map((e) => (e ? String(e.price) : ''))]),
    ];
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-radar-compset-${visibleNights[0]?.date ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-tighter md:text-[40px]">
            Competitor insights
          </h1>
          <p className="mt-2 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
            What the hotels you track are charging, and where your rate lands among them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isDemo ? (
            <span className={`${CHIP} ${QUIET}`} title="Rendered from sample data, not a live feed">
              Sample data
            </span>
          ) : (
            <span className={`${CHIP} bg-[#029768]/[0.08] text-[#027a55]`}>Live</span>
          )}
          {nights.length > 1 && (
            <label className="block">
              <span className="sr-only">Starting night</span>
              <span className="relative block">
                <select
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`h-10 cursor-pointer appearance-none rounded-full bg-white pl-4 pr-10 font-geist-mono text-[13px] tabular-nums text-[#1a1b20] ring-1 ring-[#0b1c30]/[0.12] outline-none transition-shadow duration-300 hover:ring-[#0b1c30]/20 focus:ring-2 focus:ring-[#085ac0]/60`}
                >
                  {nights.map((n, i) => (
                    <option key={n.date} value={n.date}>
                      From {i === 0 ? 'tonight' : fmtDow(n.date)}, {fmtDay(n.date)}
                    </option>
                  ))}
                </select>
                <CaretDownIcon
                  weight="light"
                  aria-hidden
                  className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#44474d]"
                />
              </span>
            </label>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Market position */}
        <Bezel className="lg:col-span-7" core="flex h-full flex-col gap-6 p-6 md:p-8">
          {tonight ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={MONO_LABEL}>
                    Suggested, {fmtDay(tonight.date)}
                  </span>
                  <p className="mt-1 text-[56px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0] md:text-[64px]">
                    {money(tonight.recommended)}
                  </p>
                </div>
                <div className="text-right">
                  <span className={MONO_LABEL}>Median</span>
                  <p className="mt-1 text-[28px] font-semibold tracking-tight tabular-nums">
                    {median != null ? money(median) : <span className="text-[#44474d]">None</span>}
                  </p>
                </div>
              </div>

              <PositionStrip
                prices={tonight.entries.map((e) => e.price)}
                median={median}
                yourRate={yourRate}
                suggested={tonight.recommended}
              />

              <div className={DIVIDER} />

              <dl className="grid grid-cols-3 gap-4 sm:gap-6">
                <Reading label="Your rate">
                  {yourRate != null ? money(yourRate) : <Missing>Not set</Missing>}
                </Reading>
                <Reading label="Price index">
                  {priceIndex != null ? (
                    priceIndex.toFixed(1)
                  ) : (
                    <Missing>{yourRate == null ? 'Needs your rate' : 'No median'}</Missing>
                  )}
                </Reading>
                <Reading label="Rank by price">
                  {rank ? (
                    <>
                      {ordinal(rank.position)}
                      <span className="text-[15px] font-medium text-[#44474d]"> of {rank.total}</span>
                    </>
                  ) : (
                    <Missing>{yourRate == null ? 'Needs your rate' : 'No prices'}</Missing>
                  )}
                </Reading>
              </dl>

              {insight && (
                <p className="mt-auto max-w-[62ch] text-pretty text-[14.5px] leading-relaxed text-[#1a1b20]">{insight}</p>
              )}
              <p className="text-[13px] leading-relaxed text-[#44474d]">
                {yourRate == null ? 'Set your rate in Settings to see your index and rank. ' : ''}
                An index of 100 is exactly the comp set median, and 1st is the most expensive.
              </p>
            </>
          ) : (
            <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d]">
              No competitor prices have been captured yet. They appear after the next collection run.
            </p>
          )}
        </Bezel>

        {/* Tonight's prices: every figure here was scraped, so the core is navy. */}
        <Bezel tone="data" className="lg:col-span-5" core="flex h-full flex-col p-6 text-white md:p-8">
          <span className="font-geist-mono text-[12px] text-[#adc6ff]">
            Prices {tonight ? `for ${fmtDow(tonight.date)}, ${fmtDay(tonight.date)}` : 'by hotel'}
          </span>
          {pulse.length > 0 ? (
            <>
              <ol className="mt-4 divide-y divide-white/[0.08]">
                {pulse.slice(0, PULSE_SHOWN).map((e, i) => {
                  const vs = median != null ? e.price - median : 0;
                  const dir = vs > 2 ? 'up' : vs < -2 ? 'down' : 'flat';
                  const Arrow = dir === 'up' ? ArrowUpIcon : dir === 'down' ? ArrowDownIcon : MinusIcon;
                  return (
                    <li key={`${e.name}-${i}`} className="flex items-baseline justify-between gap-4 py-2.5">
                      <span className="min-w-0 truncate text-[14px] text-white/80" title={e.name}>
                        {e.name}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        {median != null && (
                          <span
                            className="inline-flex items-center gap-1 font-geist-mono text-[12px] tabular-nums text-white/50"
                            title={`Against the median of ${money(median)}`}
                          >
                            <Arrow weight="light" aria-hidden className="h-3 w-3 self-center" />
                            {vs === 0 ? '$0' : signed(vs)}
                          </span>
                        )}
                        <span className="w-12 text-right font-geist-mono text-[14px] tabular-nums">{money(e.price)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-auto pt-6 font-geist-mono text-[12px] leading-relaxed text-white/50">
                {pulse.length > PULSE_SHOWN
                  ? `${pulse.length - PULSE_SHOWN} more in the watchlist below. `
                  : ''}
                Differences are against the median for this night, not each hotel&apos;s previous price.
              </p>
            </>
          ) : (
            <p className="mt-3 max-w-[40ch] text-[14.5px] leading-relaxed text-white/60">
              No competitor prices came back for this night. The comp set bound was skipped, not guessed.
            </p>
          )}
        </Bezel>

        {/* Price history */}
        <Bezel className={parity ? 'lg:col-span-7' : 'lg:col-span-12'} core="flex h-full flex-col p-6 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-[22px] font-semibold tracking-tight">Price history</h2>
            {chart && <span className={`${MONO_LABEL} tabular-nums`}>{chart.pts.length} recorded days</span>}
          </div>

          {chart ? (
            <>
              <div className="mt-6 flex flex-1 gap-3">
                <div
                  className="flex min-h-[240px] flex-col justify-between py-0 font-geist-mono text-[11.5px] tabular-nums text-[#44474d]"
                  aria-hidden
                >
                  {chart.ticks.map((t, i) => (
                    <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
                      {money(t)}
                    </span>
                  ))}
                </div>
                <div className="relative min-h-[240px] flex-1">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
                    {chart.ticks.map((_, i) => (
                      <div key={i} className="h-px w-full bg-[#0b1c30]/[0.06]" />
                    ))}
                  </div>
                  <svg
                    className="absolute inset-0 h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Suggested rate${chart.compPoints ? ' and comp set median' : ''} over ${chart.pts.length} recorded days`}
                  >
                    {chart.compLine && (
                      <polyline
                        fill="none"
                        points={chart.compLine}
                        stroke="rgba(11,28,48,0.35)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    <polyline
                      fill="none"
                      points={chart.mineLine}
                      stroke="#085ac0"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-2 flex justify-between pl-12 font-geist-mono text-[11.5px] text-[#44474d]">
                <span>{fmtDay(chart.pts[0].date)}</span>
                <span>{fmtDay(chart.pts[chart.pts.length - 1].date)}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                <Legend swatch="h-0.5 w-4 rounded-full bg-[#085ac0]">Suggested rate</Legend>
                <Legend swatch="h-0.5 w-4 rounded-full bg-[#0b1c30]/35">
                  Comp set median{chart.compPoints === 0 ? ', not yet recorded' : ''}
                </Legend>
              </div>
              {chart.compPoints === 0 && (
                <p className="mt-3 text-[13px] leading-relaxed text-[#44474d]">
                  Competitor history starts with the next collector run. Earlier days were never recorded, so nothing
                  is drawn for them.
                </p>
              )}
            </>
          ) : (
            <div className="mt-6 flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-[1.25rem] bg-[#0b1c30]/[0.04] px-6 text-center">
              <ChartLineIcon weight="light" aria-hidden className="h-8 w-8 text-[#44474d]" />
              <p className="mt-3 text-[14.5px] font-medium">Not enough history to draw a trend yet</p>
              <p className="mt-1 max-w-[44ch] text-[13px] leading-relaxed text-[#44474d]">
                One point is stored per collector run. The line appears once there are at least two.
              </p>
            </div>
          )}
        </Bezel>

        {parity && <div className="lg:col-span-5">{parity}</div>}

        {/* Watchlist */}
        <Bezel className="lg:col-span-12" core="overflow-hidden">
          <div className="space-y-5 p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-[22px] font-semibold tracking-tight">Watchlist</h2>
                <span className={`${MONO_LABEL} tabular-nums`}>
                  {tracked} of {MAX_HOTELS} tracked
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5" aria-label="Price level key">
                  {LEVELS.map((l) => (
                    <span key={l.label} className={`${CHIP} ${QUIET}`}>
                      <span className={`h-2 w-2 rounded-full ring-1 ring-[#0b1c30]/10 ${l.dot}`} aria-hidden />
                      {l.label}
                    </span>
                  ))}
                </div>
                {visibleNights.length > 0 && (
                  <PillButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={exportCsv}
                    icon={<DownloadSimpleIcon weight="light" className="h-3.5 w-3.5" />}
                  >
                    Export CSV
                  </PillButton>
                )}
              </div>
            </div>

            {/* Add a hotel */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="group relative flex-1">
                <label htmlFor="watchlist-search" className="sr-only">
                  Search nearby hotels to track
                </label>
                <MagnifyingGlassIcon
                  weight="light"
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#44474d] transition-colors duration-300 group-focus-within:text-[#085ac0]"
                />
                <input
                  id="watchlist-search"
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpen(false);
                      setActive(-1);
                    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
                      e.preventDefault();
                      setOpen(true);
                      setActive((i) => (i + 1) % suggestions.length);
                    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                      e.preventDefault();
                      setOpen(true);
                      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      // A highlighted suggestion wins; otherwise Enter adds the name as typed, like the button.
                      if (open && active >= 0 && suggestions[active] && !full) addHotel(suggestions[active]);
                      else if (query.trim() && !full) addHotel({ name: query.trim() });
                    }
                  }}
                  placeholder="Search nearby hotels to track"
                  autoComplete="off"
                  disabled={!canWrite || busy}
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="watchlist-suggestions"
                  aria-autocomplete="list"
                  aria-activedescendant={open && active >= 0 ? `watchlist-option-${active}` : undefined}
                  className="h-12 w-full rounded-full bg-white pl-11 pr-5 text-[15px] text-[#1a1b20] shadow-[inset_0_1px_2px_rgba(11,28,48,0.06)] outline-none ring-1 ring-[#0b1c30]/[0.12] transition-shadow duration-300 placeholder:text-[#6b6e75] hover:ring-[#0b1c30]/20 focus:ring-2 focus:ring-[#085ac0]/60 disabled:opacity-60"
                />
                {open && (
                  <ul
                    id="watchlist-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[1.25rem] bg-white p-1.5 shadow-[0_24px_48px_-24px_rgba(11,28,48,0.35)] ring-1 ring-[#0b1c30]/[0.08]"
                  >
                    {searching && <li className="px-4 py-2.5 text-[14px] text-[#44474d]">Searching nearby</li>}
                    {!searching && suggestions.length === 0 && (
                      <li className="px-4 py-2.5 text-[14px] text-[#44474d]">
                        No nearby match. Press Add hotel to track the name as typed.
                      </li>
                    )}
                    {suggestions.map((s, i) => (
                      <li key={`${s.name}-${s.lat}`} id={`watchlist-option-${i}`} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled={full}
                          title={full ? 'The watchlist is full. Remove a hotel to add another.' : undefined}
                          onMouseDown={(e) => e.preventDefault() /* keep focus until click fires */}
                          onClick={() => addHotel(s)}
                          onMouseEnter={() => setActive(i)}
                          className={`w-full rounded-[0.875rem] px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[#f3f5fc] disabled:opacity-50 ${i === active ? 'bg-[#f3f5fc]' : ''}`}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[14.5px] font-medium text-[#1a1b20]">{s.name}</span>
                            {s.distanceMi != null && (
                              <span className={`${MONO_LABEL} shrink-0 tabular-nums`}>{s.distanceMi} mi</span>
                            )}
                          </span>
                          {s.address && <span className="block truncate text-[13px] text-[#44474d]">{s.address}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <PillButton
                type="button"
                onClick={() => query.trim() && addHotel({ name: query.trim() })}
                disabled={!canWrite || busy || !query.trim() || full}
                title={full ? `The watchlist is full at ${MAX_HOTELS}. Remove a hotel to add another.` : undefined}
                icon={<PlusIcon weight="light" className="h-4 w-4" />}
                className="self-start sm:self-auto"
              >
                {busy ? 'Saving' : 'Add hotel'}
              </PillButton>
            </div>

            {notice && (
              <p
                role="status"
                className={`text-[14px] leading-relaxed ${notice.tone === 'warn' ? 'text-[#b45309]' : 'text-[#44474d]'}`}
              >
                {notice.text}
              </p>
            )}
            {!canWrite && (
              <p className="text-[14px] text-[#44474d]">Changing who you track needs an editor or owner role.</p>
            )}
          </div>

          {visibleNights.length > 0 ? (
            <div className="overflow-x-auto border-t border-[#0b1c30]/[0.06]">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 min-w-[200px] max-w-[280px] bg-white px-6 py-3 font-geist-mono text-[12px] font-normal text-[#44474d] md:px-8">
                      Hotel
                    </th>
                    {visibleNights.map((n) => (
                      <th
                        key={n.date}
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 text-center font-geist-mono text-[12px] font-normal text-[#44474d]"
                      >
                        <span className="block text-[#1a1b20]">{fmtDow(n.date)}</span>
                        {fmtDay(n.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-geist-mono text-[14px] tabular-nums">
                  {/* Your own property: the one cobalt row. */}
                  <tr className="bg-[#e5eeff]">
                    <th
                      scope="row"
                      className="sticky left-0 max-w-[280px] bg-[#e5eeff] px-6 py-3 text-left font-geist text-[14.5px] font-medium text-[#085ac0] md:px-8"
                    >
                      <span className="block truncate">{propertyName}</span>
                      <span className="block font-geist-mono text-[11.5px] font-normal text-[#085ac0]/80">Suggested</span>
                    </th>
                    {visibleNights.map((n) => (
                      <td key={n.date} className="px-3 py-3 text-center" title={`Suggested for ${n.date}`}>
                        <span className="flex flex-col items-center gap-1.5">
                          <span className="font-medium text-[#085ac0]">{money(n.recommended)}</span>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ring-1 ring-[#0b1c30]/10 ${levelDot(n.recommended, gridMin, gridMax)}`}
                            aria-hidden
                          />
                        </span>
                      </td>
                    ))}
                  </tr>

                  {hotels.map((h) => (
                    <tr key={h.key} className="group/row">
                      <th
                        scope="row"
                        className="sticky left-0 max-w-[280px] border-t border-[#0b1c30]/[0.06] bg-white px-6 py-3 text-left font-geist text-[14.5px] font-normal text-[#1a1b20] transition-colors duration-150 group-hover/row:bg-[#f7f8fd] md:px-8"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate" title={h.label !== h.key ? `Tracked as "${h.key}"` : h.label}>
                            {h.label}
                          </span>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => removeHotel(h.key)}
                              disabled={busy}
                              aria-label={`Remove ${h.label} from the watchlist`}
                              title="Remove from the watchlist"
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#44474d] transition-[opacity,background-color,color] duration-150 hover:bg-[#0b1c30]/[0.06] hover:text-[#1a1b20] focus-visible:opacity-100 disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 ${FOCUS}`}
                            >
                              <XIcon weight="light" className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      </th>
                      {h.perNight.map((hit, i) => (
                        <td
                          key={visibleNights[i].date}
                          className="border-t border-[#0b1c30]/[0.06] px-3 py-3 text-center transition-colors duration-150 group-hover/row:bg-[#f7f8fd]"
                          title={hit ? `${h.label}, ${visibleNights[i].date}` : 'No price captured for this night'}
                        >
                          {hit ? (
                            <span className="flex flex-col items-center gap-1.5">
                              <span className="text-[#1a1b20]">{money(hit.price)}</span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ring-1 ring-[#0b1c30]/10 ${levelDot(hit.price, gridMin, gridMax)}`}
                                aria-hidden
                              />
                            </span>
                          ) : (
                            <span className="mx-auto block h-5 w-9 rounded-full bg-[#0b1c30]/[0.05]">
                              <span className="sr-only">No price</span>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {hotels.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleNights.length + 1}
                        className="border-t border-[#0b1c30]/[0.06] px-6 py-5 font-geist text-[14.5px] text-[#44474d] md:px-8"
                      >
                        The watchlist is empty. Search above for the hotels you compete with.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mx-6 mb-6 rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d] md:mx-8 md:mb-8">
              No competitor prices captured yet. They appear after the next collection run.
            </p>
          )}

          <p className="border-t border-[#0b1c30]/[0.06] px-6 py-4 text-[13px] leading-relaxed text-[#44474d] md:px-8">
            Hotels are matched against Google Hotels results, then pinned by property token (brand and area). Additions
            take effect on the next collection run.
          </p>
        </Bezel>
      </div>
    </div>
  );
}

/* ---- parts ---- */

function Reading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={MONO_LABEL}>{label}</dt>
      <dd className="mt-1 text-[24px] font-semibold tracking-tight tabular-nums md:text-[28px]">{children}</dd>
    </div>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="block pt-1.5 text-[14.5px] font-normal tracking-normal text-[#44474d]">{children}</span>;
}

function Legend({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[#44474d]">
      <span className={swatch} aria-hidden />
      {children}
    </span>
  );
}

/**
 * Every competitor's price for the night on one axis, with the median, your
 * rate and the suggestion marked on it. Markers slide on the spring curve
 * when the starting night changes, so the markers visibly travel rather than
 * jump; under reduced motion they land in place.
 */
function PositionStrip({
  prices, median, yourRate, suggested,
}: {
  prices: number[];
  median: number | null;
  yourRate: number | null;
  suggested: number;
}) {
  if (prices.length === 0) return null;
  const all = [...prices, suggested, ...(yourRate != null ? [yourRate] : [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  // Each marker rides a full-width track translated by its percentage, so
  // only transform animates.
  const mark = (value: number, className: string, key?: number) => (
    <span
      key={key}
      className={`absolute inset-0 transition-transform duration-700 ${SPRING} motion-reduce:transition-none`}
      style={{ transform: `translateX(${4 + ((value - lo) / span) * 92}%)` }}
    >
      <span className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`} />
    </span>
  );

  return (
    <figure className="rounded-[1.25rem] bg-[#0b1c30]/[0.03] px-4 pb-4 pt-5 sm:px-5">
      <div className="relative h-10" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#0b1c30]/[0.12]" />
        {prices.map((p, i) => mark(p, 'h-3 w-0.5 bg-[#0b1c30]/30', i))}
        {median != null && mark(median, 'h-6 w-0.5 bg-[#0b1c30]/70')}
        {yourRate != null && mark(yourRate, 'h-3.5 w-3.5 bg-white ring-2 ring-[#1a1b20]')}
        {mark(suggested, 'h-3.5 w-3.5 bg-[#085ac0] ring-2 ring-white')}
      </div>
      <div className="mt-1 flex justify-between font-geist-mono text-[11.5px] tabular-nums text-[#44474d]">
        <span>{money(lo)}</span>
        <span>{money(hi)}</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <Legend swatch="h-2.5 w-2.5 rounded-full bg-[#085ac0]">Suggested</Legend>
        {yourRate != null && <Legend swatch="h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#1a1b20]">Your rate</Legend>}
        {median != null && <Legend swatch="h-3 w-0.5 rounded-full bg-[#0b1c30]/70">Median</Legend>}
        <Legend swatch="h-2.5 w-0.5 rounded-full bg-[#0b1c30]/30">
          {prices.length} {prices.length === 1 ? 'competitor' : 'competitors'}
        </Legend>
      </figcaption>
    </figure>
  );
}
