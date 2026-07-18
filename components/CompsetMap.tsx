'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup, Marker, TileLayer } from 'leaflet';

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

// CARTO basemaps: free, keyless, retina. Voyager is the warm, Apple-Maps-like
// style (cream land, soft water/parks); Dark Matter covers dark mode.
const TILE_URL = (dark: boolean) =>
  `https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`;
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface Props {
  pins: MapPin[];
  /** Small floating caption, e.g. "Prices for Tomorrow · Sat, Jul 19". */
  caption?: string;
  /** Name of a pin to fly to + open (set with a fresh object to re-trigger). */
  focus?: { name: string } | null;
  /** Fired when the user clicks a pin. */
  onPinSelect?: (name: string) => void;
}

/**
 * Map of the property + watchlisted competitors. Markers are price chips
 * (divIcons): red brand chip for the property (always on top), white price
 * pills for priced competitors, dashed "—" pills for unpriced ones. Leaflet
 * touches `window`, so it's imported inside the effect — this renders an
 * empty div on the server.
 */
export default function CompsetMap({ pins, caption, focus, onPinSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const selectRef = useRef<Props['onPinSelect']>(onPinSelect);
  selectRef.current = onPinSelect;

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
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', (e) => tileRef.current?.setUrl(TILE_URL(e.matches)));
      }

      const layer = layerRef.current!;
      layer.clearLayers();
      markersRef.current.clear();
      const located = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      for (const p of located) {
        const label = p.isProperty
          ? `● ${esc(p.name.split(' ').slice(0, 3).join(' '))}${p.price != null ? ` · $${p.price}` : ''}`
          : p.price != null
            ? `$${p.price}`
            : '—';
        const chipClass = p.isProperty ? 'map-chip map-chip-you' : p.price != null ? 'map-chip' : 'map-chip map-chip-missing';
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: '', html: `<span class="${chipClass}">${label}</span>`, iconSize: undefined }),
          zIndexOffset: p.isProperty ? 1000 : 0, // "you" always on top
        }).addTo(layer);
        marker.bindPopup(
          `<strong>${esc(p.name)}</strong>` +
            (p.address ? `<br>${esc(p.address)}` : '') +
            (p.price != null ? `<br>$${p.price} for the selected night` : p.isProperty ? '' : '<br><em>not captured this run</em>')
        );
        marker.on('click', () => selectRef.current?.(p.name));
        markersRef.current.set(p.name, marker);
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

  // fly to + open a pin when asked from outside (table row click)
  useEffect(() => {
    if (!focus) return;
    const marker = markersRef.current.get(focus.name);
    if (marker && mapRef.current) {
      mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 13), { duration: 0.6 });
      marker.openPopup();
    }
  }, [focus]);

  // tear the map down for real on unmount (hot-nav back would double-init otherwise)
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
      markersRef.current.clear();
    },
    []
  );

  return (
    <div className="relative">
      <div ref={el} className="relative z-0 h-96 w-full overflow-hidden rounded-t-xl bg-paper" />
      {caption && (
        <div className="absolute right-3 top-3 z-10 rounded-full border border-line bg-card/85 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur">
          {caption}
        </div>
      )}
    </div>
  );
}
