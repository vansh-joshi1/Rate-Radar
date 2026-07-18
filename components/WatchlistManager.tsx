'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WatchlistHotel } from '../lib/watchlist';

interface Props {
  propertyId: string;
}

interface Suggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMi: number;
  isLodging: boolean;
}

const MAX_HOTELS = 25;

/**
 * Watchlist CRUD: autocomplete add (real nearby-hotel search), locate, remove.
 * Prices and the map live in CompsetExplorer — this card manages the list.
 */
export default function WatchlistManager({ propertyId }: Props) {
  const [hotels, setHotels] = useState<WatchlistHotel[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const full = (hotels?.length ?? 0) >= MAX_HOTELS;

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

  // Debounced nearby-hotel search (rate-limited upstream).
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

  return (
    <div className="card">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight">Watchlist</h3>
        <span className={`text-xs font-semibold ${full ? 'text-warn' : 'text-muted'}`}>
          {hotels?.length ?? '…'} / {MAX_HOTELS} tracked
        </span>
      </div>
      <p className="mb-4 text-sm text-muted">
        These names are what the collector matches against booking-site results — keep them short (brand + area).
        Changes take effect on the next collection run.
      </p>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !full) {
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
                    className="w-full px-3 py-2 text-left hover:bg-ink/5 disabled:opacity-50"
                    disabled={full}
                    title={full ? 'Watchlist full — remove one to add another' : undefined}
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
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={busy || !name.trim() || full}
          title={full ? 'Watchlist full — remove one to add another' : undefined}
        >
          Add hotel
        </button>
      </form>
      {notice && <p className="mb-3 text-sm text-warn">{notice}</p>}

      {hotels === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr><th className="th">Hotel</th><th className="th">Location</th><th className="th">Status</th><th className="th" /></tr>
          </thead>
          <tbody>
            {hotels.map((h) => (
              <tr key={h.name} className="hover:bg-ink/[0.03]">
                <td className="td font-semibold">{h.name}</td>
                <td className="td text-xs text-muted">
                  {h.address ?? (h.lat != null ? `${h.lat.toFixed(4)}, ${h.lng!.toFixed(4)}` : '—')}
                </td>
                <td className="td">
                  {h.lat != null ? (
                    <span className="chip text-ok bg-ok/5">Placed</span>
                  ) : (
                    <button className="btn btn-sm" disabled={busy} onClick={() => call('PATCH', { name: h.name }, `Located ${h.name}.`)}>
                      locate
                    </button>
                  )}
                </td>
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
            ))}
            {hotels.length === 0 && (
              <tr><td colSpan={4} className="td text-muted">Watchlist is empty — add the hotels you compete with.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
