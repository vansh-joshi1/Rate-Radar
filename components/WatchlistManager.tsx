'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CompsetMap, { type MapPin } from './CompsetMap';
import type { WatchlistHotel } from '../lib/watchlist';

interface Props {
  propertyId: string;
  property: { name: string; lat: number; lng: number };
  /** Tonight's harvested competitor prices — matched to watchlist names by substring. */
  compsetEntries: { name: string; price: number }[];
}

export default function WatchlistManager({ propertyId, property, compsetEntries }: Props) {
  const [hotels, setHotels] = useState<WatchlistHotel[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`);
    if (res.ok) setHotels(((await res.json()) as { hotels: WatchlistHotel[] }).hotels);
  }, [propertyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function call(method: string, body: unknown, okNotice: string) {
    setBusy(true);
    setNotice('');
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; located?: boolean };
    if (!res.ok) setNotice(json.error ?? 'request failed');
    else setNotice(json.located === false ? 'Added, but the geocoder could not place it — try “locate” with a more specific name.' : okNotice);
    await refresh();
    setBusy(false);
  }

  const priceFor = useCallback(
    (h: WatchlistHotel) =>
      compsetEntries.find(
        (e) => e.name.toLowerCase().includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(e.name.toLowerCase())
      )?.price,
    [compsetEntries]
  );

  const pins = useMemo<MapPin[]>(() => {
    const hotelPins = (hotels ?? [])
      .filter((h) => h.lat != null && h.lng != null)
      .map((h) => ({ name: h.name, lat: h.lat!, lng: h.lng!, address: h.address, price: priceFor(h) }));
    return [{ name: property.name, lat: property.lat, lng: property.lng, isProperty: true }, ...hotelPins];
  }, [hotels, property, priceFor]);

  const unlocated = (hotels ?? []).filter((h) => h.lat == null).length;

  return (
    <div className="mb-8">
      <div className="card mb-6 p-0">
        <CompsetMap pins={pins} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-xs text-muted">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />{property.name} (you)</span>
          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-muted align-middle" />watchlist competitor · label = latest harvested price (tomorrow night)</span>
          {unlocated > 0 && <span>{unlocated} hotel{unlocated === 1 ? '' : 's'} without a map pin yet — use “locate” below</span>}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-1 text-lg font-bold tracking-tight">Watchlist</h3>
        <p className="mb-4 text-sm text-muted">
          These names are what the collector matches against booking-site results — keep them short (brand + area),
          the sites phrase full names differently. Changes take effect on the next collection run.
        </p>

        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              call('POST', { name }, 'Added and placed on the map.');
              setName('');
            }
          }}
        >
          <input
            className="field max-w-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fairfield Inn Cool Springs"
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            Add hotel
          </button>
        </form>
        {notice && <p className="mb-3 text-sm text-warn">{notice}</p>}

        {hotels === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr><th className="th">Hotel</th><th className="th">Map pin</th><th className="th">Latest price</th><th className="th" /></tr>
            </thead>
            <tbody>
              {hotels.map((h) => {
                const price = priceFor(h);
                return (
                  <tr key={h.name} className="hover:bg-ink/[0.03]">
                    <td className="td font-semibold">{h.name}</td>
                    <td className="td">
                      {h.lat != null ? (
                        <span className="text-xs text-muted">{h.address ?? `${h.lat.toFixed(4)}, ${h.lng!.toFixed(4)}`}</span>
                      ) : (
                        <button className="btn btn-sm" disabled={busy} onClick={() => call('PATCH', { name: h.name }, `Located ${h.name}.`)}>
                          locate
                        </button>
                      )}
                    </td>
                    <td className="td font-serif">{price != null ? `$${price}` : <span className="font-sans text-xs text-muted">not captured this run</span>}</td>
                    <td className="td text-right">
                      <button
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => call('DELETE', { name: h.name }, `Removed ${h.name}.`)}
                        title="Remove from watchlist"
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {hotels.length === 0 && (
                <tr><td colSpan={4} className="td text-muted">Watchlist is empty — add the hotels you compete with.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
