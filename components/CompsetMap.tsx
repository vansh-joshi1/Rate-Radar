'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

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

/**
 * Leaflet map of the property + watchlisted competitors. OpenStreetMap tiles
 * (free, attribution required). Leaflet touches `window`, so it's imported
 * inside the effect — this component renders an empty div on the server.
 */
export default function CompsetMap({ pins }: { pins: MapPin[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(el.current, { scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const layer = layerRef.current!;
      layer.clearLayers();
      const located = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      for (const p of located) {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: p.isProperty ? 9 : 7,
          color: p.isProperty ? '#c8102e' : '#241f16',
          fillColor: p.isProperty ? '#c8102e' : '#5e584e',
          fillOpacity: 0.85,
          weight: 2,
        }).addTo(layer);

        const label = p.price != null ? `$${p.price}` : p.isProperty ? 'You' : undefined;
        if (label) {
          marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -8], className: 'map-price' });
        }
        marker.bindPopup(
          `<strong>${esc(p.name)}</strong>` +
            (p.address ? `<br>${esc(p.address)}` : '') +
            (p.price != null ? `<br>$${p.price} · latest harvested price` : '<br>no price captured this run')
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
    },
    []
  );

  return <div ref={el} className="relative z-0 h-96 w-full border border-line bg-paper" />;
}
