'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CompsetMap, { type MapPin } from './CompsetMap';
import type { WatchlistHotel } from '../lib/watchlist';

interface Props {
  propertyId: string;
  property: { name: string; lat: number; lng: number };
  /** Tonight's harvested competitor prices — matched to watchlist names by substring. */
  compsetEntries: { name: string; price: number }[];
}

interface Suggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMi: number;
  isLodging: boolean;
}

export default function WatchlistManager({ propertyId, property, compsetEntries }: Props) {
  const [hotels, setHotels] = useState<WatchlistHotel[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`);
    if (res.ok) setHotels(((await res.json()) as { hotels: WatchlistHotel[] }).hotels);
  }, [propertyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced nearby-hotel search (Nominatim is rate-limited to 1 req/s).
  function onNameChange(value: string) {
    setName(value);
    setNotice('');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      setSearching(true);
      try {
        const res = await fetch(
          `/api/hotel-search?propertyId=${propertyId}&q=${encodeURIComponent(value.trim())}`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const { results } = (await res.json()) as { results: Suggestion[] };
          setSuggestions(results);
          setOpen(true);
        }
      } catch {
        /* aborted or offline — keep whatever we had */
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  function pickSuggestion(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setName('');
    call('POST', { name: s.name, lat: s.lat, lng: s.lng, address: s.address }, `Added ${s.name}.`);
  }

  async function call(method: string, body: unknown, okNotice: string) {
    setBusy(true);
    setNotice('');
    const res = await fetch(`/api/watchlist?propertyId=${propertyId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; located?: boolean };
    if (!res.ok) {
      setNotice(json.error ?? 'request failed');
      await refresh();
      setBusy(false);
      return;
    }
    let notice = json.located === false
      ? 'Added, but the geocoder could not place it — try “locate” with a more specific name.'
      : okNotice;

    if (method === 'POST') {
      // A new hotel has no harvested prices yet — try to kick off a real collection run.
      const kick = await fetch('/api/collect-now', { method: 'POST' });
      notice += kick.ok
        ? ' Collection run triggered — its prices should appear in ~10 minutes.'
        : ' Its prices will appear after the next scheduled collection run.';
    } else if (method === 'DELETE') {
      // Removal only needs refiltering of already-collected data — instant.
      const re = await fetch(`/api/recompute?propertyId=${propertyId}`, { method: 'POST' });
      if (re.ok) notice += ' Applied to the current data.';
    }
    setNotice(notice);
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
              setOpen(false);
              call('POST', { name }, 'Added and placed on the map.');
              setName('');
            }
          }}
        >
          <div className="relative w-full max-w-sm">
            <input
              className="field"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Start typing a hotel name…"
              disabled={busy}
              role="combobox"
              aria-expanded={open}
              aria-controls="hotel-suggestions"
            />
            {open && (
              <ul
                id="hotel-suggestions"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-card shadow-md"
              >
                {searching && <li className="px-3 py-2 text-sm text-muted">Searching nearby…</li>}
                {!searching && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted">
                    No nearby match — press Add to use the name as typed.
                  </li>
                )}
                {suggestions.map((s) => (
                  <li key={`${s.name}-${s.lat}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-ink/5"
                      onMouseDown={(e) => e.preventDefault() /* keep input focus until click fires */}
                      onClick={() => pickSuggestion(s)}
                    >
                      <div className="text-sm font-semibold">
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
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>
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
