'use client';
import { useMemo, useRef, useState } from 'react';
import CompsetMap, { type MapPin } from './CompsetMap';
import { haversineMiles } from '../lib/geo';

export interface ExplorerBlock {
  date: string;
  label: string; // "Tonight" | "Tomorrow" | "Fri" …
  sublabel: string; // "Sat, Jul 19"
  entries: { name: string; price: number }[];
}

interface WatchHotel {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}

interface Props {
  property: { name: string; lat: number; lng: number };
  /** Owner-entered (authoritative) or scraped direct rate; null = not set. */
  yourRate: { price: number; source: 'owner' | 'scrape' } | null;
  blocks: ExplorerBlock[];
  watchlist: WatchHotel[];
}

const MEDIAN_MIN_PRICED = 3;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function nameMatch(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
}

/**
 * Night tabs driving a linked map + comparison table for the selected night.
 * Tabs exist only for nights we actually collected — no invented data.
 */
export default function CompsetExplorer({ property, yourRate, blocks, watchlist }: Props) {
  const [selected, setSelected] = useState(0);
  const [focusPin, setFocusPin] = useState<{ name: string } | null>(null);
  const [flashRow, setFlashRow] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const block = blocks[selected];

  const view = useMemo(() => {
    if (!block) return null;
    const priced = block.entries.map((e) => {
      const hotel = watchlist.find((w) => nameMatch(w.name, e.name));
      const distanceMi =
        hotel?.lat != null && hotel?.lng != null ? haversineMiles(property.lat, property.lng, hotel.lat, hotel.lng) : null;
      return { ...e, hotel, distanceMi };
    });
    const unpriced = watchlist.filter((w) => !block.entries.some((e) => nameMatch(w.name, e.name)));
    const med = priced.length >= MEDIAN_MIN_PRICED ? median(priced.map((p) => p.price)) : null;

    type Row =
      | { kind: 'hotel'; name: string; price: number; distanceMi: number | null }
      | { kind: 'you' }
      | { kind: 'median'; price: number };
    const rows: Row[] = priced.map((p) => ({ kind: 'hotel' as const, name: p.name, price: p.price, distanceMi: p.distanceMi }));
    if (yourRate) rows.push({ kind: 'you' });
    if (med != null) rows.push({ kind: 'median', price: med });
    rows.sort((a, b) => {
      const pa = a.kind === 'you' ? yourRate!.price : a.price;
      const pb = b.kind === 'you' ? yourRate!.price : b.price;
      return pa - pb;
    });

    const cheaper = priced.filter((p) => p.price < (yourRate?.price ?? Infinity)).length;
    return { priced, unpriced, med, rows, cheaper };
  }, [block, watchlist, property, yourRate]);

  if (!block || !view) return null;

  const pins: MapPin[] = [
    { name: property.name, lat: property.lat, lng: property.lng, price: yourRate?.price, isProperty: true },
    ...view.priced
      .filter((p) => p.hotel?.lat != null && p.hotel?.lng != null)
      .map((p) => ({ name: p.name, lat: p.hotel!.lat!, lng: p.hotel!.lng!, price: p.price, address: p.hotel!.address })),
    ...view.unpriced
      .filter((w) => w.lat != null && w.lng != null)
      .map((w) => ({ name: w.name, lat: w.lat!, lng: w.lng!, address: w.address })),
  ];

  const pinToRow = (name: string) => {
    setFlashRow(name);
    tableRef.current?.querySelector(`[data-row="${CSS.escape(name)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setFlashRow(null), 1400);
  };

  const delta = (price: number) => {
    if (!yourRate) return '—';
    const d = price - yourRate.price;
    if (d === 0) return '±$0';
    return d > 0 ? `↑ +$${d}` : `↓ −$${Math.abs(d)}`;
  };

  return (
    <div className="mb-6">
      {/* stat row for the selected night */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card py-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">Your rate</div>
          {yourRate ? (
            <>
              <div className="font-serif text-3xl font-semibold text-accent">${yourRate.price}</div>
              <div className="text-xs text-muted">{yourRate.source === 'owner' ? 'entered by you' : 'scraped from redroof.com'}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted">
              not set — <a href="/overview" className="font-semibold text-accent">set it on the Overview</a>
            </div>
          )}
        </div>
        <div className="card py-4" title={view.unpriced.length > 0 ? `${view.unpriced.length} competitor${view.unpriced.length === 1 ? '' : 's'} excluded — no price captured` : undefined}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">Rank ({block.label.toLowerCase()})</div>
          <div className="text-2xl font-extrabold tracking-tight">
            {yourRate ? `#${view.cheaper + 1}` : '#—'} <span className="text-base font-semibold text-muted">of {view.priced.length + (yourRate ? 1 : 0)} priced</span>
          </div>
          <div className="text-xs text-muted">cheapest → priciest{view.unpriced.length > 0 ? ` · ${view.unpriced.length} not captured` : ''}</div>
        </div>
        <div className="card py-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">vs. competitor median</div>
          {view.med != null && yourRate ? (
            <>
              <div className="text-2xl font-extrabold tracking-tight">
                {yourRate.price === Math.round(view.med) ? 'at median' : `${yourRate.price > view.med ? '↑ +$' : '↓ −$'}${Math.abs(Math.round(yourRate.price - view.med))}`}
              </div>
              <div className="text-xs text-muted">median ${Math.round(view.med)}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted">
              {view.med == null ? `unavailable — fewer than ${MEDIAN_MIN_PRICED} competitors priced` : 'set your rate to compare'}
            </div>
          )}
        </div>
      </div>

      {/* night tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {blocks.map((b, i) => (
          <button
            key={b.date}
            onClick={() => setSelected(i)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              i === selected ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-paper'
            }`}
          >
            {b.label} <span className={`ml-1 font-normal ${i === selected ? 'text-white/80' : 'text-muted'}`}>{b.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="card mb-6 p-0">
        <CompsetMap
          pins={pins}
          caption={`Prices for ${block.label} · ${block.sublabel}`}
          focus={focusPin}
          onPinSelect={pinToRow}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-xs text-muted">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />{property.name} (you)</span>
          <span>white pill = priced competitor · dashed — = not captured this run</span>
        </div>
      </div>

      {/* comparison table */}
      <div ref={tableRef} className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Hotel</th>
                <th className="th">Distance</th>
                <th className="th">Rate · {block.sublabel}</th>
                <th className="th">Δ vs. you</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => {
                if (r.kind === 'median') {
                  return (
                    <tr key="median" className="bg-ink/[0.04] font-bold uppercase">
                      <td className="td">Competitor median</td>
                      <td className="td" />
                      <td className="td font-serif text-lg">${Math.round(r.price)}</td>
                      <td className="td text-muted">{yourRate ? delta(Math.round(r.price)) : '—'}</td>
                    </tr>
                  );
                }
                if (r.kind === 'you') {
                  return (
                    <tr key="you" className="bg-accent/5 font-semibold [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent">
                      <td className="td">{property.name} (you{yourRate!.source === 'owner' ? ' — current rate' : ' — listed on redroof.com'})</td>
                      <td className="td">—</td>
                      <td className="td font-serif text-lg text-accent">${yourRate!.price}</td>
                      <td className="td">—</td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={r.name}
                    data-row={r.name}
                    onClick={() => setFocusPin({ name: r.name })}
                    className={`cursor-pointer transition-colors hover:bg-ink/[0.03] ${flashRow === r.name ? 'bg-accent/10' : ''}`}
                  >
                    <td className="td">{r.name}</td>
                    <td className="td text-muted">{r.distanceMi != null ? `${r.distanceMi} mi` : '—'}</td>
                    <td className="td font-serif text-lg">${r.price}</td>
                    <td className="td text-muted">{delta(r.price)}</td>
                  </tr>
                );
              })}
              {view.priced.length === 0 && (
                <tr>
                  <td colSpan={4} className="td text-muted">No competitor prices captured for this night.</td>
                </tr>
              )}
              {view.unpriced.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="td pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted">
                      No price captured ({view.unpriced.length})
                    </td>
                  </tr>
                  {view.unpriced.map((w) => (
                    <tr key={w.name} className="text-muted [&>td:first-child]:border-l-2 [&>td:first-child]:border-dashed [&>td:first-child]:border-l-line">
                      <td className="td">{w.name}</td>
                      <td className="td">
                        {w.lat != null && w.lng != null ? `${haversineMiles(property.lat, property.lng, w.lat, w.lng)} mi` : '—'}
                      </td>
                      <td className="td">—</td>
                      <td className="td">—</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
