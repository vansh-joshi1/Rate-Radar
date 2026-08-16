'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup, TileLayer } from 'leaflet';

/*
 * Demand events on a dark map, with the property at the centre. Leaflet
 * touches `window`, so it is imported inside the effect — this renders an
 * empty div on the server, same as CompsetMap.
 */

export interface EventPin {
  id: string;
  name: string;
  venue: string;
  lat: number;
  lng: number;
  kind: string;
  attendance: number;
  date: string;
  score: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/* Glyph per event kind, matching the sidebar's event iconography. */
const GLYPH: Record<string, string> = {
  concert: 'music_note',
  sports: 'sports_football',
  convention: 'groups',
  university: 'school',
  holiday: 'celebration',
  other: 'event',
};

export default function EventsMap({
  property,
  pins,
}: {
  property: { name: string; lat: number; lng: number };
  pins: EventPin[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const tileRef = useRef<TileLayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
        tileRef.current = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 20 }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const layer = layerRef.current!;
      layer.clearLayers();

      // The property, pulsing at centre.
      L.marker([property.lat, property.lng], {
        icon: L.divIcon({ className: '', html: '<span class="event-pin-you"></span>' }),
        zIndexOffset: 1000,
      })
        .addTo(layer)
        .bindPopup(`<strong>${esc(property.name)}</strong><br>Your property`);

      for (const p of pins) {
        // Major events read hot, everything else cool — same threshold the
        // scoring uses to decide a night is event-driven.
        const hot = p.score >= 40;
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '',
            html: `<span class="event-pin ${hot ? 'event-pin-hot' : ''}">
                     <span class="material-symbols-outlined">${GLYPH[p.kind] ?? 'event'}</span>
                   </span>`,
          }),
        })
          .addTo(layer)
          // Hover label, per the design. Venues a couple of miles apart overlap
          // at this zoom, so a name on hover is the only way to tell them apart
          // without clicking each one.
          .bindTooltip(`${esc(p.name)} · ${p.attendance.toLocaleString()}`, {
            direction: 'top',
            offset: [0, -18],
            className: 'event-tip',
          })
          .bindPopup(
            `<strong>${esc(p.name)}</strong><br>${esc(p.venue)}<br>` +
              `Est. ${p.attendance.toLocaleString()} attendees · score ${p.score}`,
          );
      }

      const all: [number, number][] = [
        [property.lat, property.lng],
        ...pins.map((p) => [p.lat, p.lng] as [number, number]),
      ];
      // Tight padding: the property sits ~16mi from the downtown venues, so a
      // generous pad zooms out far enough that the pins become specks.
      mapRef.current!.fitBounds(L.latLngBounds(all).pad(0.08), { maxZoom: 13 });
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, property]);

  // Tear down for real on unmount — hot-nav back would double-init otherwise.
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
    },
    [],
  );

  return <div ref={el} className="absolute inset-0 z-0" />;
}
