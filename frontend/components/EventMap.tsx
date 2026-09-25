'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, LayerSpecification, Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl';
import { CrosshairSimpleIcon } from '@phosphor-icons/react/dist/ssr/CrosshairSimple';

/*
 * Demand events on a real map, themed as an instrument (DESIGN.md → the Navy
 * Is Data Rule: every blip is a scored event from the collector).
 *
 * Basemap: OpenFreeMap vector tiles (OpenStreetMap data, no API key, no usage
 * cap), recoloured layer by layer into the product's navy: water deepest, land
 * a step up with a pale coastline stroke, roads as faint cobalt-grey lines.
 * The previous Leaflet map used CARTO raster tiles, which now come back
 * watermarked without a key, and a raster basemap can only be tinted.
 *
 * On top, in order:
 *   - range rings in miles around the property, with a faint wash inside the
 *     outer ring, because "how far" is the question the page is asking;
 *   - a radar sweep turning around the property. Each venue pings as the beam
 *     crosses its bearing, so the motion says what the page does: it scans the
 *     area for demand. Sweep and pings share one clock (the document timeline),
 *     and neither exists under reduced motion;
 *   - a line from the property to the venue being read, hovered or pinned;
 *   - the blips: sized by attendance, filled by demand band, grouped by venue
 *     so two nights at one stadium are one blip with a count.
 */

export interface MapEvent {
  id: string;
  name: string;
  venue: string;
  date: string;
  attendance: number;
  score: number;
  lat: number;
  lng: number;
}

export interface VenueBlip {
  key: string;
  venue: string;
  lat: number;
  lng: number;
  miles: number;
  /** Degrees clockwise from north, as seen from the property. */
  deg: number;
  bearing: string;
  score: number;
  attendance: number;
  events: MapEvent[];
}

type LngLat = { lat: number; lng: number };

const toRad = (d: number) => (d * Math.PI) / 180;

/** Initial great-circle bearing, degrees clockwise from north. */
function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

function milesBetween(a: LngLat, b: LngLat): number {
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/* Outer ring radius and ring spacing. Picked in round pairs so the ring labels
   read as a scale (5, 10, 15 mi) rather than as 3.8 and 11.3, with a little
   headroom past the farthest blip. */
const SCALES = [
  { range: 2, step: 0.5 },
  { range: 3, step: 1 },
  { range: 5, step: 1 },
  { range: 8, step: 2 },
  { range: 10, step: 2 },
  { range: 15, step: 5 },
  { range: 20, step: 5 },
  { range: 30, step: 10 },
  { range: 50, step: 10 },
  { range: 75, step: 25 },
  { range: 100, step: 25 },
];

/**
 * The map's scale, from EVERY placed event rather than the filtered ones, so
 * the frame holds still while filters and the night scrubber change what is
 * shown. A frame that jumped on every click would make positions unreadable.
 */
export function scaleFor(property: LngLat, events: LngLat[]): { range: number; step: number } {
  const farthest = Math.max(0, ...events.map((e) => milesBetween(property, e)));
  return (
    SCALES.find((sc) => sc.range >= farthest * 1.12) ?? { range: Math.ceil((farthest * 1.12) / 50) * 50, step: 50 }
  );
}

/** Demand band, on the scoring engine's own thresholds (DESIGN.md → Chips). */
export function band(score: number): 'major' | 'meaningful' | 'minor' | 'quiet' {
  return score >= 70 ? 'major' : score >= 40 ? 'meaningful' : score >= 15 ? 'minor' : 'quiet';
}

export const BLIP_FILL: Record<ReturnType<typeof band>, string> = {
  major: 'bg-[#085ac0] ring-2 ring-white',
  meaningful: 'bg-[#adc6ff] ring-1 ring-[#0b1c30]/40',
  minor: 'bg-white/60 ring-1 ring-[#0b1c30]/40',
  // Too small to matter: kept on the map and dimmed, never dropped.
  quiet: 'bg-[#0b1c30]/60 ring-1 ring-inset ring-white/50',
};

/** One blip per location, so the list can point at the blip an event sits in. */
export const venueKey = (e: LngLat) => `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;

export function useVenueBlips(property: LngLat, events: MapEvent[]): VenueBlip[] {
  return useMemo(() => {
    const byVenue = new Map<string, MapEvent[]>();
    for (const e of events) {
      const key = venueKey(e);
      byVenue.set(key, [...(byVenue.get(key) ?? []), e]);
    }
    return [...byVenue.entries()].map(([key, evs]) => {
      const at = { lat: evs[0].lat, lng: evs[0].lng };
      const deg = bearingDeg(property, at);
      return {
        key,
        venue: evs[0].venue,
        ...at,
        miles: milesBetween(property, at),
        deg,
        bearing: compass(deg),
        score: Math.max(...evs.map((e) => e.score)),
        attendance: Math.max(...evs.map((e) => e.attendance)),
        events: [...evs].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }, [property, events]);
}

/* ---- basemap theme ---- */

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const NAVY = '#0b1c30';
/* Land sits a step above the panel's navy and water below it, so the coast
   reads at a glance without either leaving the navy family. */
const LAND = '#10253c';
const WATER = '#06121f';
const PARK = '#122b44';
const BUILDING = '#18344f';
const PALE = (a: number) => `rgba(173, 198, 255, ${a})`;

/* Everything that adds noise without answering "how far is it": road casings
   (the themed roads are single strokes), shields and POI icons (their sprites
   are drawn for a light map), rail dashes, ice, country labels, and the
   residential landuse polygons, which render as pixel blocks at city zoom. */
const DROP =
  /casing|subtle|shield|airport|aeroway|dashline|ice_shelf|glacier|landuse_residential|highway-name-path|highway-name-minor|waterway_line_label|label_country|label_state/;
/* In the demo the coastline is real but the town is invented, so no real
   place, road or water name may appear next to it. */
const DROP_DEMO = /^label_|water_name|highway-name/;

function themeLayer(l: LayerSpecification, hidePlaces: boolean): LayerSpecification[] {
  if (DROP.test(l.id) || (hidePlaces && DROP_DEMO.test(l.id))) return [];
  const id = l.id;

  switch (l.type) {
    case 'background':
      return [{ ...l, paint: { 'background-color': LAND } }];
    case 'fill': {
      if (id === 'water') {
        // The water fill, then its edge: a thin pale stroke is what makes the
        // shore look drawn rather than cut out.
        const { paint: _p, ...rest } = l;
        return [
          { ...l, paint: { 'fill-color': WATER, 'fill-antialias': true } },
          { ...rest, id: 'coastline', type: 'line', paint: { 'line-color': PALE(0.28), 'line-width': 0.8 } } as LayerSpecification,
        ];
      }
      const color = id === 'building' ? BUILDING : id.includes('park') || id.includes('wood') ? PARK : LAND;
      // Vegetation starts a few zooms in, where it reads as shapes, not noise.
      const minzoom = id.includes('park') || id.includes('wood') ? Math.max(l.minzoom ?? 0, 10) : l.minzoom;
      return [
        {
          ...l,
          ...(minzoom != null ? { minzoom } : {}),
          paint: { 'fill-color': color, 'fill-antialias': true, ...(id === 'building' ? { 'fill-opacity': 0.8 } : {}) },
        } as LayerSpecification,
      ];
    }
    case 'line': {
      const paint = { ...(l.paint ?? {}) } as Record<string, unknown>;
      if (id === 'waterway') paint['line-color'] = WATER;
      else if (id.startsWith('boundary')) paint['line-color'] = PALE(0.18);
      else if (id.includes('motorway')) paint['line-color'] = PALE(0.42);
      else if (id.includes('major')) paint['line-color'] = PALE(0.28);
      else paint['line-color'] = PALE(0.14);
      delete paint['line-opacity'];
      return [{ ...l, paint } as LayerSpecification];
    }
    case 'symbol': {
      const layout = { ...(l.layout ?? {}) } as Record<string, unknown>;
      delete layout['icon-image'];
      return [
        {
          ...l,
          layout,
          paint: { 'text-color': PALE(0.75), 'text-halo-color': NAVY, 'text-halo-width': 1.2, 'text-halo-blur': 0.5 },
        } as LayerSpecification,
      ];
    }
    default:
      return [];
  }
}

async function themedStyle(hidePlaces: boolean): Promise<{ style: StyleSpecification; font: string[] }> {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error(`style ${res.status}`);
  const base = (await res.json()) as StyleSpecification;
  // The upright face the style already ships glyphs for (the first one found
  // can be the italic used for water names).
  const fonts = base.layers
    .map((l) => (l.layout as Record<string, unknown> | undefined)?.['text-font'])
    .filter((f): f is string[] => Array.isArray(f) && f.every((x) => typeof x === 'string'));
  const font = fonts.find((f) => f.some((x) => /regular/i.test(x))) ?? ['Noto Sans Regular'];
  return { style: { ...base, layers: base.layers.flatMap((l) => themeLayer(l, hidePlaces)) }, font };
}

/* ---- overlay geometry ---- */

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function ringFeatures(center: LngLat, range: number, step: number) {
  const latMi = 69.0;
  const lngMi = 69.0 * Math.cos(toRad(center.lat));
  const circle = (r: number) => {
    const coords: [number, number][] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * 2 * Math.PI;
      coords.push([center.lng + (Math.sin(t) * r) / lngMi, center.lat + (Math.cos(t) * r) / latMi]);
    }
    return coords;
  };
  const rings: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];
  for (let r = step; r <= range + 1e-9; r += step) {
    rings.push({ type: 'Feature', properties: { outer: r >= range - 1e-9 }, geometry: { type: 'LineString', coordinates: circle(r) } });
    labels.push({
      type: 'Feature',
      properties: { label: `${+r.toFixed(1)} mi` },
      // On the south-west diagonal: clear of the bottom edge and the attribution.
      geometry: { type: 'Point', coordinates: [center.lng - (Math.SQRT1_2 * r) / lngMi, center.lat - (Math.SQRT1_2 * r) / latMi] },
    });
  }
  return {
    rings: { type: 'FeatureCollection', features: rings } as GeoJSON.FeatureCollection,
    labels: { type: 'FeatureCollection', features: labels } as GeoJSON.FeatureCollection,
    area: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(range)] } }],
    } as GeoJSON.FeatureCollection,
    bounds: [
      [center.lng - range / lngMi, center.lat - range / latMi],
      [center.lng + range / lngMi, center.lat + range / latMi],
    ] as [[number, number], [number, number]],
  };
}

/* ---- component ---- */

/** One full turn of the sweep, in ms. Slow enough to read as scanning, not spinning. */
const SWEEP_MS = 7000;

/** Blip diameter in px: area tracks attendance, clamped so a 5K stays findable. */
const blipSize = (attendance: number) => Math.round(Math.min(34, Math.max(12, 6 + Math.sqrt(attendance) / 6)));

const fmtMi = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());

/* Extra room at the bottom for the outer ring's label and the attribution. */
const FIT_PADDING = { top: 24, right: 24, bottom: 40, left: 24 };

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function EventMap({
  property,
  blips,
  range,
  step,
  hidePlaceNames,
  active: activeKey,
  pinned,
  onHover,
  onPin,
}: {
  property: LngLat & { name: string };
  blips: VenueBlip[];
  range: number;
  /** Miles between rings. */
  step: number;
  /** Demo only: hide the basemap's real place names. */
  hidePlaceNames: boolean;
  /** The venue being described: hovered or focused, else the pinned one. */
  active: string | null;
  /** The venue clicked to stay described. */
  pinned: string | null;
  onHover: (key: string | null) => void;
  onPin: (key: string | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  /** Document-timeline time the sweep started; the pings are scheduled from it. */
  const sweepStart = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /** First complete render; until then the panel says it is loading. */
  const [painted, setPainted] = useState(false);
  /** The user has panned or zoomed away from the fitted frame. */
  const [moved, setMoved] = useState(false);
  /* Marker elements, rendered into by portals so blips stay React (and keep
     the same classes, focus handling and state as the rest of the page). */
  const [slots, setSlots] = useState<Record<string, HTMLElement>>({});

  const { lat, lng } = property;
  const geo = useMemo(() => ringFeatures({ lat, lng }, range, step), [lat, lng, range, step]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  /** Re-seats the sweep disc on the outer ring; null when there is no sweep. */
  const placeSweep = useRef<(() => void) | null>(null);

  // Create the map once per property.
  useEffect(() => {
    let cancelled = false;
    let sweepAnim: Animation | null = null;
    (async () => {
      try {
        const [{ default: maplibregl }, { style, font }] = await Promise.all([
          import('maplibre-gl'),
          themedStyle(hidePlaceNames),
        ]);
        if (cancelled || !el.current) return;

        const map = new maplibregl.Map({
          container: el.current,
          style,
          bounds: geoRef.current.bounds,
          fitBoundsOptions: { padding: FIT_PADDING },
          attributionControl: false,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          maxZoom: 16,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        mapRef.current = map;

        /* Overlays that live between the canvas and the markers: appended to
           the canvas container before any marker is, so markers stack above. */
        const host = map.getCanvasContainer();
        const vignette = document.createElement('div');
        vignette.className = 'pointer-events-none absolute inset-0 shadow-[inset_0_0_72px_rgba(4,11,20,0.85)]';
        host.appendChild(vignette);

        if (!reducedMotion()) {
          const sweep = document.createElement('div');
          // Hidden until the first render: a beam turning over an empty panel reads as broken.
          sweep.className = 'map-sweep pointer-events-none absolute overflow-hidden rounded-full opacity-0 transition-opacity duration-700';
          const beam = document.createElement('div');
          beam.className = 'map-sweep-beam absolute inset-0';
          sweep.appendChild(beam);
          host.appendChild(sweep);

          // Keep the sweep's disc on the outer ring as the map pans and zooms.
          const place = () => {
            const c = map.project([lng, lat]);
            const edge = map.project([lng, lat + rangeRef.current / 69]);
            const r = Math.abs(c.y - edge.y);
            sweep.style.left = `${c.x - r}px`;
            sweep.style.top = `${c.y - r}px`;
            sweep.style.width = sweep.style.height = `${2 * r}px`;
          };
          map.on('move', place);
          map.on('resize', place);
          placeSweep.current = place;
          map.once('load', () => sweep.classList.replace('opacity-0', 'opacity-100'));
          place();

          sweepAnim = beam.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: SWEEP_MS,
            iterations: Infinity,
          });
          sweepStart.current = (document.timeline.currentTime as number) ?? 0;
          sweepAnim.startTime = sweepStart.current;
        }

        // Only a gesture counts as moving away; our own fitBounds does not.
        const markMoved = (e: { originalEvent?: unknown }) => e.originalEvent && setMoved(true);
        map.on('dragstart', markMoved);
        map.on('zoomstart', markMoved);

        map.on('load', () => {
          // Compact attribution starts expanded on a wide map; start it folded to its (i).
          el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');

          map.addSource('area', { type: 'geojson', data: geoRef.current.area });
          map.addSource('rings', { type: 'geojson', data: geoRef.current.rings });
          map.addSource('ring-labels', { type: 'geojson', data: geoRef.current.labels });
          map.addSource('link', { type: 'geojson', data: EMPTY });
          map.addLayer({ id: 'area', type: 'fill', source: 'area', paint: { 'fill-color': 'rgba(8, 90, 192, 0.07)' } });
          map.addLayer({
            id: 'rings',
            type: 'line',
            source: 'rings',
            paint: {
              'line-color': ['case', ['get', 'outer'], PALE(0.5), PALE(0.2)],
              'line-width': ['case', ['get', 'outer'], 1.4, 1],
            },
          });
          map.addLayer({
            id: 'ring-labels',
            type: 'symbol',
            source: 'ring-labels',
            layout: { 'text-field': ['get', 'label'], 'text-font': font, 'text-size': 11, 'text-offset': [0, -0.8] },
            paint: { 'text-color': PALE(0.85), 'text-halo-color': NAVY, 'text-halo-width': 1.5 },
          });
          map.addLayer({
            id: 'link',
            type: 'line',
            source: 'link',
            layout: { 'line-cap': 'round' },
            paint: { 'line-color': 'rgba(255, 255, 255, 0.75)', 'line-width': 1.5 },
          });

          const you = document.createElement('div');
          markers.current.set('__you', new maplibregl.Marker({ element: you }).setLngLat([lng, lat]).addTo(map));
          setSlots((s) => ({ ...s, __you: you }));
          setReady(true);
          // 'load' fires after the first visually complete render, tiles included.
          setPainted(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      sweepAnim?.cancel();
      sweepStart.current = null;
      placeSweep.current = null;
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
      setPainted(false);
      setMoved(false);
      setSlots({});
    };
  }, [lat, lng, hidePlaceNames]);

  const refit = (animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(geo.bounds, { padding: FIT_PADDING, duration: animate && !reducedMotion() ? 700 : 0 });
    setMoved(false);
  };

  // Rings and framing follow the scale.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('area') as GeoJSONSource | undefined)?.setData(geo.area);
    (map.getSource('rings') as GeoJSONSource | undefined)?.setData(geo.rings);
    (map.getSource('ring-labels') as GeoJSONSource | undefined)?.setData(geo.labels);
    placeSweep.current?.();
    refit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geo]);

  // One marker per venue, added and removed as the filters change.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const { default: maplibregl } = await import('maplibre-gl');
      if (cancelled) return;
      const want = new Set(blips.map((b) => b.key));
      const next: Record<string, HTMLElement> = {};
      markers.current.forEach((m, key) => {
        if (key !== '__you' && !want.has(key)) {
          m.remove();
          markers.current.delete(key);
        } else next[key] = m.getElement();
      });
      for (const b of blips) {
        if (markers.current.has(b.key)) continue;
        const node = document.createElement('div');
        markers.current.set(b.key, new maplibregl.Marker({ element: node }).setLngLat([b.lng, b.lat]).addTo(map));
        next[b.key] = node;
      }
      setSlots(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, blips]);

  const active = blips.find((b) => b.key === activeKey) ?? null;

  // The line from the property to the venue being read.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('link') as GeoJSONSource | undefined)?.setData(
      active
        ? {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [[lng, lat], [active.lng, active.lat]] },
          }
        : EMPTY,
    );
  }, [ready, active, lat, lng]);

  /* A ping on each blip as the beam crosses its bearing. Scheduled on the
     sweep's own start time, so the two can never drift apart. */
  useEffect(() => {
    const start = sweepStart.current;
    if (!ready || start == null || !el.current) return;
    const anims: Animation[] = [];
    el.current.querySelectorAll<HTMLElement>('[data-ping]').forEach((node) => {
      const deg = Number(node.dataset.ping);
      const a = node.animate(
        [
          { opacity: 0.9, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(2.6)', offset: 0.16 },
          { opacity: 0, transform: 'scale(2.6)' },
        ],
        { duration: SWEEP_MS, iterations: Infinity, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
      a.startTime = start + (deg / 360) * SWEEP_MS;
      anims.push(a);
    });
    return () => anims.forEach((a) => a.cancel());
  }, [ready, slots, blips]);

  return (
    <div className="event-map relative h-[360px] overflow-hidden rounded-[1.25rem] bg-[#0b1c30] md:h-[460px]">
      {/* h-full, not absolute: MapLibre sets position: relative on its container. */}
      <div ref={el} className="h-full w-full" />

      {moved && (
        <button
          type="button"
          onClick={() => refit(true)}
          aria-label="Recenter on your property"
          title="Recenter on your property"
          className="absolute right-[10px] top-[84px] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0b1c30] shadow-[0_16px_32px_-16px_rgba(5,12,24,0.55)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#f3f5fc] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
        >
          <CrosshairSimpleIcon weight="light" aria-hidden className="h-4 w-4" />
        </button>
      )}

      {!painted && !failed && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-geist-mono text-[12px] text-[#adc6ff]/70">
          Loading map
        </p>
      )}

      {failed && (
        <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[14px] leading-relaxed text-white/60">
          The map could not load. Every event is still listed with its distance.
        </p>
      )}

      {slots.__you &&
        createPortal(
          <span className="pointer-events-none relative flex items-center justify-center" title={property.name}>
            <span aria-hidden className="radar-pulse absolute h-16 w-16 rounded-full bg-[#085ac0]/40 opacity-0" />
            <span className="relative h-3.5 w-3.5 rounded-full bg-[#085ac0] ring-2 ring-white" />
          </span>,
          slots.__you,
        )}

      {blips.map((b) => {
        const slot = slots[b.key];
        if (!slot) return null;
        const size = blipSize(b.attendance);
        const on = b.key === activeKey;
        const dim = activeKey != null && !on;
        return createPortal(
          <button
            type="button"
            onClick={() => onPin(pinned === b.key ? null : b.key)}
            onMouseEnter={() => onHover(b.key)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(b.key)}
            onBlur={() => onHover(null)}
            aria-pressed={pinned === b.key}
            aria-label={`${b.venue}, ${fmtMi(b.miles)} miles ${b.bearing}, ${b.events.length} event${b.events.length === 1 ? '' : 's'}`}
            className="blip-in group relative flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span
              style={{ width: size, height: size }}
              className={`relative flex items-center justify-center rounded-full shadow-[0_4px_12px_-4px_rgba(5,12,24,0.7)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                BLIP_FILL[band(b.score)]
              } ${on ? 'scale-110' : 'group-hover:scale-110'} ${dim ? 'opacity-40' : ''}`}
            >
              <span aria-hidden data-ping={b.deg} className="pointer-events-none absolute inset-0 rounded-full opacity-0 ring-2 ring-[#adc6ff]" />
              {on && <span aria-hidden className="absolute -inset-1.5 rounded-full ring-1 ring-white/80" />}
            </span>
            {b.events.length > 1 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-geist-mono text-[10px] font-medium tabular-nums text-[#0b1c30]">
                {b.events.length}
              </span>
            )}
          </button>,
          slot,
          b.key,
        );
      })}

      {/* Readout for the venue under the pointer. Bottom-left, clear of the
          zoom buttons (top-right) and the attribution (bottom-right). */}
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-3 left-3 z-10 w-[min(16rem,calc(100%-1.5rem))] rounded-[1rem] bg-white p-3.5 text-[#1a1b20] shadow-[0_16px_32px_-16px_rgba(5,12,24,0.55)]"
        >
          <p className="truncate text-[14px] font-semibold tracking-tight">{active.venue}</p>
          <p className="font-geist-mono text-[12px] tabular-nums text-[#44474d]">
            {fmtMi(active.miles)} mi {active.bearing} of you
          </p>
          <ul className="mt-2 space-y-1 border-t border-[#0b1c30]/[0.06] pt-2">
            {active.events.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{e.name}</span>
                <span className="shrink-0 font-geist-mono text-[12px] tabular-nums text-[#44474d]">{e.score}</span>
              </li>
            ))}
          </ul>
          {active.events.length > 3 && (
            <p className="mt-1 text-[12px] text-[#44474d]">{active.events.length - 3} more at this venue</p>
          )}
        </div>
      )}
    </div>
  );
}
