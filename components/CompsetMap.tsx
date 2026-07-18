'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup, TileLayer } from 'leaflet';

export interface MapPin {
  name: string;
  lat: number;
  lng: number;
  price?: number;
  address?: string;
  isProperty?: boolean;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// CARTO basemaps: free, keyless, retina — the clean cartography modern
// dashboards use. Light/dark variants follow the OS theme.
const TILE_URL = (dark: boolean) =>
  `https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`;
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Map of the property + watchlisted competitors. Markers are price chips
 * (divIcons) rather than dot-plus-tooltip pairs. Leaflet touches `window`,
 * so it's imported inside the effect — this renders an empty div on the
 * server.
 */
export default function CompsetMap({ pins }: { pins: MapPin[] }) {
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
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        mapRef.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
        tileRef.current = L.tileLayer(TILE_URL(dark), { attribution: ATTRIBUTION, maxZoom: 20 }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
        // follow OS theme changes live
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', (e) => tileRef.current?.setUrl(TILE_URL(e.matches)));
      }

      const layer = layerRef.current!;
      layer.clearLayers();
      const located = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      for (const p of located) {
        const label = p.isProperty ? `● ${esc(p.name.split(' ').slice(0, 3).join(' '))}` : p.price != null ? `$${p.price}` : '·';
        const chipClass = p.isProperty ? 'map-chip map-chip-you' : p.price != null ? 'map-chip' : 'map-chip map-chip-dot';
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: '', html: `<span class="${chipClass}">${label}</span>`, iconSize: undefined }),
        }).addTo(layer);
        marker.bindPopup(
          `<strong>${esc(p.name)}</strong>` +
            (p.address ? `<br>${esc(p.address)}` : '') +
            (p.price != null ? `<br>$${p.price} · latest harvested price` : p.isProperty ? '' : '<br>no price captured this run')
        );
      }

      if (located.length > 0) {
        const bounds = L.latLngBounds(located.map((p) => [p.lat, p.lng] as [number, number]));
        mapRef.current!.fitBounds(bounds.pad(0.3), { maxZoom: 14 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pins]);

  // tear the map down for real on unmount (hot-nav back would double-init otherwise)
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
    },
    []
  );

  return <div ref={el} className="relative z-0 h-96 w-full overflow-hidden rounded-t-xl bg-paper" />;
}
