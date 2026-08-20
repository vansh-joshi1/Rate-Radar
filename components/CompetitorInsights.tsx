'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanWrite } from './RoleProvider';

/*
 * Competitor Insights, built to the supplied design: filter row, opportunity
 * banner, price-tracking chart, market position, competitor pulse, and the
 * daily rate heatmap.
 *
 * Every figure comes from collected data. Where a series genuinely does not
 * exist yet the chart draws nothing and says so, rather than inventing a
 * plausible line — a fabricated competitor trend is the one thing that would
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
  tiers: { tierId: string; label: string }[];
  compSetName: string;
  /** Watchlist names as of render — the grid's row source. */
  initialWatchlist: string[];
}

export const MAX_HOTELS = 25;

const Icon = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`} {...(fill ? { 'data-weight': 'fill' } : {})} aria-hidden>
    {name}
  </span>
);

const CARD =
  'bg-card border border-line rounded-xl p-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-hover-lift';

const FIELD =
  'bg-card border border-line rounded px-sm py-2 font-body-md text-body-md text-ink outline-none transition-colors duration-200 hover:border-muted focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer';

const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });

const dowLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/* Price level across the whole grid, so a dot means the same thing in every
   row and column. Terciles rather than fixed thresholds — what counts as a
   high rate is relative to this comp set, not an absolute dollar figure. */
function levelClass(price: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (price - min) / (max - min);
  if (t < 1 / 3) return 'bg-level-low';
  if (t < 2 / 3) return 'bg-level-mid';
  return 'bg-level-high';
}

export default function CompetitorInsights({
  propertyId, propertyName, nights, history, yourRate, tiers, compSetName, initialWatchlist,
}: Props) {
  const [tierId, setTierId] = useState(tiers[0]?.tierId ?? '');
  const [dateFrom, setDateFrom] = useState(nights[0]?.date ?? '');

  // --- watchlist editing, folded into the grid the design puts it above ---
  const canWrite = useCanWrite();
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
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
    setNotice('');
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
          setOpen(true);
        }
      } catch {
        /* aborted or offline — keep whatever we had */
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  async function addHotel(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setQuery('');
    setBusy(true);
    setNotice('');
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: s.name, lat: s.lat, lng: s.lng, address: s.address }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; located?: boolean };
    if (!res.ok) {
      setNotice(json.error ?? 'Could not add that hotel.');
    } else {
      // A new hotel has no harvested prices yet — try to kick off a real run.
      const kick = await fetch('/api/collect-now', { method: 'POST' });
      setNotice(
        `Added ${s.name}.${json.located === false ? ' The geocoder could not place it — prices still collect.' : ''}` +
          (kick.ok
            ? ' Collection run triggered — prices should appear in ~10 minutes.'
            : ' Prices appear after the next scheduled run.'),
      );
    }
    await refresh();
    setBusy(false);
  }

  async function removeHotel(name: string) {
    setBusy(true);
    setNotice('');
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setNotice(json.error ?? 'Could not remove that hotel.');
    } else {
      // Removal only refilters already-collected data — applies immediately.
      const re = await fetch(`/api/recompute?propertyId=${propertyId}`, { method: 'POST' });
      setNotice(`Removed ${name}.${re.ok ? ' Applied to the current data.' : ''}`);
    }
    await refresh();
    setBusy(false);
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
   * entries. Keying rows on the raw strings listed each hotel twice — once
   * with prices, once empty. Matching on the same substring rule the collector
   * uses keeps one row per hotel, labelled with the fuller collected name.
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

    // Anything priced that no watchlist name claims — shouldn't normally
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

  const priced = useMemo(() => hotels.filter((h) => h.latest != null), [hotels]);

  const tonight = visibleNights[0];
  const median = tonight?.median ?? null;
  const priceIndex = median != null && yourRate != null ? (yourRate / median) * 100 : null;

  // Rank among the comp set on the nearest night — 1 = most expensive.
  const rank = useMemo(() => {
    if (!tonight || yourRate == null) return null;
    const all = [...tonight.entries.map((e) => e.price), yourRate].sort((a, b) => b - a);
    return { position: all.indexOf(yourRate) + 1, total: all.length };
  }, [tonight, yourRate]);

  // Chart series — only points we actually recorded.
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
      lo, hi,
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

  // Opportunity banner — real conditions only, in priority order.
  const insight = useMemo(() => {
    if (!tonight) return null;
    if (median != null && yourRate != null && tonight.recommended > yourRate) {
      return `Your listed rate is $${yourRate} against a recommendation of $${tonight.recommended} for ${dayLabel(tonight.date)}. The comp-set median is $${median} — there is $${tonight.recommended - yourRate} of headroom before you reach the recommendation.`;
    }
    if (median != null && tonight.recommended > median) {
      return `The recommendation for ${dayLabel(tonight.date)} is $${tonight.recommended}, $${tonight.recommended - median} above the comp-set median of $${median}. Demand signals support holding above market.`;
    }
    if (median != null) {
      return `The recommendation for ${dayLabel(tonight.date)} is $${tonight.recommended}, at or below the comp-set median of $${median}. Quiet night — the compset bound is doing the work.`;
    }
    return `No competitor prices were collected for ${dayLabel(tonight.date)}, so the compset bound is skipped for this night rather than estimated.`;
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
    <div className="mx-auto max-w-7xl space-y-xl">
      {/* Header & Filters */}
      <div className="flex flex-col justify-between gap-md lg:flex-row lg:items-end">
        <div>
          <h2 className="mb-xs font-headline-lg text-headline-lg text-ink">Competitor Insights</h2>
          <p className="font-body-md text-body-md text-muted">
            Detailed comparison of pricing strategies across your selected competitive set.
          </p>
        </div>
        <div className="flex flex-wrap gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-md text-label-md uppercase text-muted" htmlFor="f-compset">Comp Set</label>
            <select id="f-compset" className={`${FIELD} min-w-[180px]`} defaultValue={compSetName}>
              <option>{compSetName}</option>
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-md text-label-md uppercase text-muted" htmlFor="f-room">Room Type</label>
            <select
              id="f-room"
              className={`${FIELD} min-w-[150px]`}
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
            >
              {tiers.map((t) => (
                <option key={t.tierId} value={t.tierId}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-md text-label-md uppercase text-muted" htmlFor="f-date">From</label>
            <input
              id="f-date"
              type="date"
              className={FIELD}
              value={dateFrom}
              min={nights[0]?.date}
              max={nights[nights.length - 1]?.date}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Opportunity banner */}
      {insight && (
        <div className="flex items-start gap-md rounded-lg border border-accent bg-accent-muted p-md transition-shadow duration-300 hover:shadow-hover-lift">
          <Icon name="bolt" fill className="mt-xs text-accent" />
          <div>
            <h4 className="mb-xs font-headline-md text-headline-md text-accent">Rate Opportunity Detected</h4>
            <p className="mb-sm font-body-md text-body-md text-ink">{insight}</p>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-12 gap-lg">
        <div className={`col-span-12 flex flex-col lg:col-span-8 ${CARD}`}>
          <div className="mb-lg flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-ink">
              Price Tracking{chart ? ` (${chart.pts.length} recorded days)` : ''}
            </h3>
            <button
              onClick={exportCsv}
              className="flex items-center gap-xs rounded border border-line bg-card px-sm py-1 font-label-md text-label-md text-accent transition-colors duration-200 hover:border-accent hover:bg-paper"
            >
              <Icon name="download" className="text-[16px]" /> Export
            </button>
          </div>

          {chart ? (
            <>
              <div className="relative ml-10 flex min-h-[300px] flex-1 items-end border-b border-l border-line pt-xl">
                <div className="absolute -left-10 bottom-0 top-0 flex flex-col justify-between py-2 font-data-mono text-data-mono tabular-nums text-muted">
                  {chart.ticks.map((t, i) => <span key={i}>${t}</span>)}
                </div>
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {[0, 1, 2, 3, 4].map((i) => <div key={i} className="w-full border-t border-line/30" />)}
                </div>
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {chart.compLine && (
                    <polyline
                      fill="none"
                      points={chart.compLine}
                      stroke="rgb(var(--muted-rgb))"
                      strokeDasharray="4"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <polyline
                    fill="none"
                    points={chart.mineLine}
                    stroke="rgb(var(--accent-rgb))"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="ml-sm mt-sm flex justify-between font-data-mono text-data-mono text-muted">
                <span>{dayLabel(chart.pts[0].date)}</span>
                <span>{dayLabel(chart.pts[chart.pts.length - 1].date)}</span>
              </div>
              <div className="mt-md flex justify-center gap-lg">
                <div className="flex items-center gap-xs">
                  <div className="h-0.5 w-3 bg-accent" />
                  <span className="font-label-md text-label-md">Our recommendation</span>
                </div>
                <div className="flex items-center gap-xs">
                  <div className="h-0.5 w-3 bg-muted" />
                  <span className="font-label-md text-label-md">
                    Comp median{chart.compPoints === 0 ? ' (not yet recorded)' : ''}
                  </span>
                </div>
              </div>
              {chart.compPoints === 0 && (
                <p className="mt-sm text-center text-xs text-muted">
                  Competitor history starts accumulating from the next collector run — earlier days were never
                  recorded, so nothing is drawn for them.
                </p>
              )}
            </>
          ) : (
            <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-center">
              <Icon name="timeline" className="text-4xl text-muted" />
              <p className="mt-sm font-body-md text-body-md text-muted">
                Not enough recorded history to plot a trend yet.
              </p>
              <p className="mt-xs text-xs text-muted">
                One point is stored per collector run — the line appears once there are at least two.
              </p>
            </div>
          )}
        </div>

        <div className="col-span-12 flex flex-col gap-lg lg:col-span-4">
          <div className={CARD}>
            <h3 className="mb-md font-headline-md text-headline-md text-ink">Market Position</h3>
            <div className="space-y-md">
              <div>
                <div className="mb-xs flex justify-between">
                  <span className="font-label-md text-label-md text-muted">Price Index vs Comp Set</span>
                  <span className="font-data-mono text-data-mono font-bold tabular-nums text-ink">
                    {priceIndex != null ? `${priceIndex.toFixed(1)}%` : '—'}
                  </span>
                </div>
                {/* Fills by scaleX, not width, so the transition is composited
                    — and so there IS one: this used to declare
                    `transition-colors` while the only property that changed was
                    `width`, so the meter teleported on every Room Type / From
                    change. The bar is 6px tall, so the right cap flattening at
                    low fills is imperceptible; if it ever isn't, transition
                    `width 300ms` instead — the element has no siblings, so the
                    layout invalidation stays contained. */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-1.5 w-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:duration-150"
                    style={{ transform: `scaleX(${Math.min(1, Math.max(0, (priceIndex ?? 0) / 200))})` }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-label-md text-label-md text-muted">Rank (Price)</span>
                <span className="font-data-mono text-data-mono font-bold tabular-nums text-ink">
                  {rank ? `${rank.position} of ${rank.total}` : '—'}
                </span>
              </div>
              <div className="border-t border-line pt-md">
                <p className="font-body-md text-body-md text-ink">
                  {priceIndex == null || !rank
                    ? yourRate == null
                      ? 'No rate on file for your property yet — set one in Settings to see your market position.'
                      : 'No competitor prices collected for this night, so there is no position to compute.'
                    : `You are priced ${priceIndex >= 100 ? 'above' : 'below'} the comp-set median, positioned ${rank.position}${rank.position === 1 ? 'st' : rank.position === 2 ? 'nd' : rank.position === 3 ? 'rd' : 'th'} most expensive of ${rank.total}.`}
                </p>
              </div>
            </div>
          </div>

          <div className={`flex-1 ${CARD}`}>
            <h3 className="mb-md font-headline-md text-headline-md text-ink">Competitor Pulse</h3>
            {priced.length > 0 ? (
              <ul className="space-y-sm">
                {priced.map((h) => {
                  const vsMedian = median != null ? h.latest! - median : 0;
                  const dir = vsMedian > 2 ? 'up' : vsMedian < -2 ? 'down' : 'flat';
                  return (
                    <li
                      key={h.key}
                      className="-mx-sm flex items-center justify-between rounded border-b border-line/50 px-sm py-sm transition-colors duration-200 last:border-0 hover:bg-paper"
                    >
                      <span className="min-w-0 truncate pr-sm font-body-md text-body-md text-ink">{h.label}</span>
                      <span
                        className={`flex shrink-0 items-center gap-xs font-data-mono text-data-mono tabular-nums ${
                          dir === 'up' ? 'text-ok' : dir === 'down' ? 'text-bad' : 'text-muted'
                        }`}
                        title={median != null ? `${vsMedian >= 0 ? '+' : ''}${vsMedian} vs median $${median}` : undefined}
                      >
                        <Icon
                          name={dir === 'up' ? 'arrow_upward' : dir === 'down' ? 'arrow_downward' : 'remove'}
                          className="text-[16px]"
                        />
                        ${h.latest}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-body-md text-body-md text-muted">
                No competitor prices collected for this window.
              </p>
            )}
            {priced.length > 0 && (
              <p className="mt-md text-xs text-muted">
                Arrows compare each hotel to the comp-set median for the nearest night — not to its own previous
                price, which isn&apos;t retained yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Add-to-watchlist row */}
      <div className="animate-fade-in-up delay-300 mb-lg flex items-center gap-md">
        <div className="group relative flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search nearby competitors..."
            disabled={!canWrite || busy}
            role="combobox"
            aria-expanded={open}
            aria-controls="watchlist-suggestions"
            className="w-full rounded border border-line bg-card py-2 pl-10 pr-4 font-body-md text-body-md text-ink outline-none transition-all duration-300 focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          {open && (
            <ul
              id="watchlist-suggestions"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-card shadow-overlay-sm"
            >
              {searching && <li className="px-3 py-2 font-body-md text-body-md text-muted">Searching nearby…</li>}
              {!searching && suggestions.length === 0 && (
                <li className="px-3 py-2 font-body-md text-body-md text-muted">
                  No nearby match — press Add to Watchlist to use the name as typed.
                </li>
              )}
              {suggestions.map((s) => (
                <li key={`${s.name}-${s.lat}`}>
                  <button
                    type="button"
                    disabled={full}
                    title={full ? 'Watchlist full — remove one to add another' : undefined}
                    onMouseDown={(e) => e.preventDefault() /* keep focus until click fires */}
                    onClick={() => addHotel(s)}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-ink/5 disabled:opacity-50"
                  >
                    <div className="font-body-md text-body-md font-semibold text-ink">
                      {s.name}
                      <span className="ml-2 font-normal text-muted">{s.distanceMi} mi</span>
                    </div>
                    <div className="truncate text-xs text-muted">{s.address}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => query.trim() && addHotel({ name: query.trim() })}
          disabled={!canWrite || busy || !query.trim() || full}
          title={full ? `Watchlist full (${MAX_HOTELS}) — remove one to add another` : undefined}
          className="flex shrink-0 items-center gap-xs rounded bg-accent px-lg py-2 font-label-md text-label-md text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-hover-lift active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          <Icon name="add" className="text-[18px]" />
          Add to Watchlist
        </button>
      </div>

      {notice && <p className="-mt-md mb-md font-body-md text-body-md text-warn">{notice}</p>}
      {!canWrite && (
        <p className="-mt-md mb-md font-body-md text-body-md text-muted">
          Changing who you track needs an editor or owner role.
        </p>
      )}

      {/* Watchlist grid */}
      <div className={`animate-fade-in-up delay-400 overflow-hidden !p-0 ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-sm border-b border-line bg-paper p-lg">
          <h3 className="font-headline-md text-headline-md text-ink">Watchlist</h3>
          <div className="flex items-center gap-sm">
            <span className="font-label-md text-label-md text-muted">Price Level:</span>
            {([['Low', 'bg-level-low'], ['Mid', 'bg-level-mid'], ['High', 'bg-level-high']] as const).map(
              ([label, cls]) => (
                <span
                  key={label}
                  className="flex items-center gap-xs rounded-full border border-line/30 bg-card px-sm py-1"
                >
                  <span className={`h-2 w-2 rounded-full ${cls}`} />
                  <span className="font-label-md text-label-md text-muted">{label}</span>
                </span>
              ),
            )}
          </div>
        </div>

        {visibleNights.length > 0 ? (
          <div className="relative z-0 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-paper">
                  <th className="w-48 p-md font-label-md text-label-md uppercase text-muted">Hotel</th>
                  {visibleNights.map((n) => (
                    <th
                      key={n.date}
                      className="border-l border-line p-md text-center font-label-md text-label-md uppercase text-muted"
                    >
                      {dayLabel(n.date)} ({dowLabel(n.date)})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-data-mono text-data-mono tabular-nums">
                <tr className="border-b border-line bg-accent/10">
                  <td className="border-r border-line p-md font-headline-md text-accent">{propertyName}</td>
                  {visibleNights.map((n) => (
                    <td
                      key={n.date}
                      title={`Recommended for ${n.date}`}
                      className="heatmap-cell cursor-pointer border-r border-line p-md text-center"
                    >
                      <div className="flex flex-col items-center gap-xs">
                        <span className="font-bold text-ink">${n.recommended}</span>
                        <div className={`h-1 w-8 rounded-full ${levelClass(n.recommended, gridMin, gridMax)}`} />
                      </div>
                    </td>
                  ))}
                </tr>

                {hotels.map((h) => (
                  <tr
                    key={h.key}
                    className="group/row border-b border-line transition-colors last:border-0 hover:bg-paper"
                  >
                    <td className="border-r border-line p-md font-body-md text-ink">
                      <span className="flex items-center justify-between gap-sm">
                        <span className="min-w-0 truncate" title={h.label !== h.key ? `Tracked as “${h.key}”` : undefined}>
                          {h.label}
                        </span>
                        {canWrite && (
                          <button
                            onClick={() => removeHotel(h.key)}
                            disabled={busy}
                            aria-label={`Remove ${h.label} from watchlist`}
                            title="Remove from watchlist"
                            className="shrink-0 text-muted opacity-0 transition-opacity hover:text-bad focus:opacity-100 group-hover/row:opacity-100"
                          >
                            <Icon name="close" className="text-[16px]" />
                          </button>
                        )}
                      </span>
                    </td>
                    {h.perNight.map((hit, i) => (
                      <td
                        key={visibleNights[i].date}
                        className={`border-r border-line p-md text-center ${hit ? 'heatmap-cell cursor-pointer' : ''}`}
                        title={hit ? `${h.label} — ${visibleNights[i].date}` : 'No price captured for this night'}
                      >
                        {hit ? (
                          <div className="flex flex-col items-center gap-xs">
                            <span className="text-ink">${hit.price}</span>
                            <div className={`h-1.5 w-1.5 rounded-full ${levelClass(hit.price, gridMin, gridMax)}`} />
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

                {hotels.length === 0 && (
                  <tr>
                    <td colSpan={visibleNights.length + 1} className="p-lg font-body-md text-body-md text-muted">
                      Watchlist is empty — search above for the hotels you compete with.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-lg font-body-md text-body-md text-muted">
            No competitor prices captured yet — they appear after the next collection run.
          </p>
        )}

        <p className="border-t border-line px-lg py-md text-xs text-muted">
          {tracked} / {MAX_HOTELS} tracked · names are matched against booking-site results, so keep them short
          (brand + area). Additions take effect on the next collection run.
        </p>
      </div>
    </div>
  );
}
