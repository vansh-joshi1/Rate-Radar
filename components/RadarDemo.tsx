'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/*
 * The landing hero's signature visual — and the product's core mechanic, made
 * touchable. Drag your property around the compset and the recommendation
 * recomputes live from where you land: closer to the expensive end of the
 * market and the number rises, closer to the budget end and it falls.
 *
 * Built to the fluid-interface rules rather than as a CSS transition:
 *  - the pin tracks the pointer 1:1, respecting where it was grabbed
 *  - release hands the pointer's velocity straight to a spring, so there is no
 *    seam between dragging and animating
 *  - a flick projects its own resting point the way scroll deceleration does
 *  - the spring integrates from wherever the pin currently IS, so grabbing it
 *    mid-flight redirects it instead of restarting it
 *  - past the edges it rubber-bands rather than hitting a wall
 *
 * Everything is illustrative sample data — the same four competitors and the
 * same $79 baseline the rest of the page uses.
 */

type Competitor = { x: number; y: number; price: number; name: string };

/** Positions are fractions of the surface, so the geometry survives a resize. */
const COMPETITORS: Competitor[] = [
  { x: 0.2, y: 0.22, price: 96, name: 'Comfort Inn' },
  { x: 0.74, y: 0.31, price: 112, name: 'Hampton Inn' },
  { x: 0.28, y: 0.66, price: 84, name: 'Quality Inn' },
  { x: 0.66, y: 0.58, price: 101, name: 'La Quinta' },
];

const BASELINE = 79;
const HOME = { x: 0.5, y: 0.5 };

/* Apple's projection function from Designing Fluid Interfaces — exponential
   decay, not the v²/2a from the physics textbook. 0.99 rather than the 0.998
   scroll value: this is a 340px box, and a full scroll-length throw would put
   the pin three panels away. */
function project(velocity: number, decelerationRate = 0.99) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/* Progressive resistance past an edge: the further out you pull, the less the
   pin follows. A hard clamp reads as frozen; this reads as "there's nothing
   more over here". */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Inverse-square-weighted local market rate, then a small direct-booking edge. */
function priceAt(fx: number, fy: number) {
  let weightSum = 0;
  let priceSum = 0;
  let nearest = 0;
  let nearestD2 = Infinity;

  COMPETITORS.forEach((c, i) => {
    const dx = fx - c.x;
    const dy = fy - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = i;
    }
    const weight = 1 / (d2 + 0.03);
    weightSum += weight;
    priceSum += weight * c.price;
  });

  const local = priceSum / weightSum;
  return { rate: Math.round(local * 0.905), nearest };
}

const TrendIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M3.5 16.5 9 11l3.5 3.5L20.5 6.5" />
    <path d="M15.5 6.5h5v5" />
  </svg>
);

export default function RadarDemo() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  // Physics lives in refs — React never re-renders for a position change.
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const history = useRef<{ t: number; x: number; y: number }[]>([]);
  const raf = useRef<number | null>(null);
  const lastFrame = useRef(0);
  const bounce = useRef(0);
  const reduced = useRef(false);

  // Only things that are actually rendered live in state, and they change far
  // less often than the position does.
  const [readout, setReadout] = useState(() => priceAt(HOME.x, HOME.y));
  const [active, setActive] = useState(false);
  const [touched, setTouched] = useState(false);

  const paint = useCallback(() => {
    const pin = pinRef.current;
    if (!pin) return;
    pin.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;

    const { w, h } = size.current;
    if (!w || !h) return;
    const next = priceAt(pos.current.x / w, pos.current.y / h);
    setReadout((prev) => (prev.rate === next.rate && prev.nearest === next.nearest ? prev : next));
  }, []);

  /* One rAF loop, two independent springs. X and Y are integrated separately —
     a single spring on the 2D distance desyncs the moment the two axes carry
     different velocities. */
  const tick = useCallback(
    (now: number) => {
      const dt = Math.min((now - lastFrame.current) / 1000, 1 / 30);
      lastFrame.current = now;

      const response = 0.4;
      const damping = bounce.current;
      const w0 = (2 * Math.PI) / response;
      const k = w0 * w0;
      const c = 2 * damping * w0;

      let settled = true;
      (['x', 'y'] as const).forEach((axis) => {
        const dx = pos.current[axis] - target.current[axis];
        const a = -k * dx - c * vel.current[axis];
        vel.current[axis] += a * dt;
        pos.current[axis] += vel.current[axis] * dt;
        if (Math.abs(pos.current[axis] - target.current[axis]) > 0.3 || Math.abs(vel.current[axis]) > 3) {
          settled = false;
        }
      });

      if (settled) {
        pos.current = { ...target.current };
        vel.current = { x: 0, y: 0 };
        paint();
        raf.current = null;
        if (pinRef.current) pinRef.current.style.willChange = 'auto';
        return;
      }

      paint();
      raf.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const startSpring = useCallback(
    (dampingRatio: number) => {
      bounce.current = dampingRatio;
      if (reduced.current) {
        // Reduced motion: land immediately rather than travelling. Dragging
        // itself stays 1:1 — that motion is the user's own, not the interface's.
        pos.current = { ...target.current };
        vel.current = { x: 0, y: 0 };
        paint();
        return;
      }
      if (pinRef.current) pinRef.current.style.willChange = 'transform';
      if (raf.current === null) {
        lastFrame.current = performance.now();
        raf.current = requestAnimationFrame(tick);
      }
    },
    [paint, tick],
  );

  const measure = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const prev = size.current;
    const fx = prev.w ? pos.current.x / prev.w : HOME.x;
    const fy = prev.h ? pos.current.y / prev.h : HOME.y;
    size.current = { w: rect.width, h: rect.height };
    pos.current = { x: fx * rect.width, y: fy * rect.height };
    target.current = { ...pos.current };
    paint();
  }, [paint]);

  useLayoutEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    measure();
    // A second pass after the first paint: at mount the hero can still be
    // reflowing (font swap, grid settling), and a width measured mid-reflow
    // parks the pin off-centre.
    const settle = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (surfaceRef.current) ro.observe(surfaceRef.current);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(settle);
      ro.disconnect();
      window.removeEventListener('resize', measure);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [measure]);

  /* Always read the live rect at the start of an interaction. A size cached at
     mount goes stale the moment the hero reflows (font swap, breakpoint change)
     and a stale width makes the pin rubber-band against an edge that isn't
     there. */
  const syncSize = useCallback((rect: DOMRect) => {
    if (!rect.width || !rect.height) return;
    const prev = size.current;
    if (prev.w === rect.width && prev.h === rect.height) return;
    const fx = prev.w ? pos.current.x / prev.w : HOME.x;
    const fy = prev.h ? pos.current.y / prev.h : HOME.y;
    size.current = { w: rect.width, h: rect.height };
    pos.current = { x: fx * rect.width, y: fy * rect.height };
    target.current = { ...pos.current };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const surface = surfaceRef.current;
    if (!surface) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);

    // Grabbing mid-flight redirects the pin: we stop the spring but keep the
    // pin exactly where it is on screen, never where it was headed.
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    vel.current = { x: 0, y: 0 };

    const rect = surface.getBoundingClientRect();
    syncSize(rect);
    grabOffset.current = {
      x: e.clientX - rect.left - pos.current.x,
      y: e.clientY - rect.top - pos.current.y,
    };
    history.current = [{ t: performance.now(), x: pos.current.x, y: pos.current.y }];
    dragging.current = true;
    setActive(true);
    setTouched(true);
    if (pinRef.current) pinRef.current.style.willChange = 'transform';
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    size.current = { w, h };

    const rawX = e.clientX - rect.left - grabOffset.current.x;
    const rawY = e.clientY - rect.top - grabOffset.current.y;

    pos.current = { x: resist(rawX, w), y: resist(rawY, h) };

    const now = performance.now();
    history.current.push({ t: now, x: pos.current.x, y: pos.current.y });
    if (history.current.length > 6) history.current.shift();

    paint();
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    const { w, h } = size.current;

    // Velocity from the recent sample window, not the last event — a single
    // frame's delta is far too noisy to throw with.
    const pts = history.current;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dt = last && first ? (last.t - first.t) / 1000 : 0;
    const vx = dt > 0.001 ? (last.x - first.x) / dt : 0;
    const vy = dt > 0.001 ? (last.y - first.y) / dt : 0;

    // Where the throw wants to end up, then clamped back inside the surface.
    const projX = pos.current.x + project(vx);
    const projY = pos.current.y + project(vy);
    target.current = {
      x: Math.max(0, Math.min(w, projX)),
      y: Math.max(0, Math.min(h, projY)),
    };

    vel.current = { x: vx, y: vy };
    const flicked = Math.hypot(vx, vy) > 220;
    // Overshoot only when the gesture itself carried momentum. A pin you nudged
    // and let go of should not bounce.
    startSpring(flicked ? 0.8 : 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const { w, h } = size.current;
    const stepX = w * 0.05;
    const stepY = h * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-stepX, 0],
      ArrowRight: [stepX, 0],
      ArrowUp: [0, -stepY],
      ArrowDown: [0, stepY],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setTouched(true);
    target.current = {
      x: Math.max(0, Math.min(w, target.current.x + move[0])),
      y: Math.max(0, Math.min(h, target.current.y + move[1])),
    };
    startSpring(1);
  }

  const uplift = Math.round(((readout.rate - BASELINE) / BASELINE) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-overlay-lg">
      {/* window chrome */}
      <div className="flex h-11 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="ml-auto text-[11px] font-medium text-slate-400">Red Roof Inn · Franklin, TN</div>
      </div>

      {/* radar surface */}
      <div ref={surfaceRef} className="relative h-[340px] bg-[#131b2e]">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #adc6ff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* competitor rates — the nearest one lights up as you approach it, so
            the number in the corner always shows its work. */}
        {COMPETITORS.map((c, i) => {
          const near = readout.nearest === i;
          return (
            <div
              key={c.name}
              className="absolute transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                top: `${c.y * 100}%`,
                left: `${c.x * 100}%`,
                transform: near ? 'scale(1.25)' : 'scale(1)',
              }}
            >
              <span
                className="block h-2 w-2 rounded-full bg-[#67dca8] transition-shadow duration-300"
                style={{
                  boxShadow: near ? '0 0 16px rgba(103,220,168,0.95)' : '0 0 10px rgba(103,220,168,0.7)',
                }}
              />
              <span
                className={`absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 text-[10px] font-semibold transition-colors duration-300 ${
                  near
                    ? 'border-[#67dca8]/60 bg-white text-slate-900'
                    : 'border-white/15 bg-white/90 text-slate-700'
                }`}
              >
                ${c.price}
              </span>
            </div>
          );
        })}

        {/* your property — the draggable one */}
        <div ref={pinRef} className="absolute left-0 top-0">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Your property position on the compset map. Drag, or use the arrow keys, to see how nearby competitor pricing changes tonight's recommendation."
            aria-valuemin={BASELINE}
            aria-valuemax={130}
            aria-valuenow={readout.rate}
            aria-valuetext={`$${readout.rate}, nearest competitor ${COMPETITORS[readout.nearest].name} at $${COMPETITORS[readout.nearest].price}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className="relative flex -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:cursor-grabbing"
            style={{ width: 44, height: 44 }}
          >
            {/* 44px hit target, but the visible pin stays small */}
            <span
              className={`absolute rounded-full border border-[#085ac0]/40 ${active ? '' : 'animate-ping'}`}
              style={{ width: 192, height: 192, opacity: 0.2 }}
            />
            <span
              className={`absolute rounded-full border border-[#085ac0]/50 ${active ? '' : 'animate-ping'}`}
              style={{ width: 128, height: 128, opacity: 0.4, animationDelay: '1s' }}
            />
            <span
              className="rounded-full bg-[#085ac0] transition-transform duration-150 ease-[cubic-bezier(0,0,0.2,1)]"
              style={{
                width: 14,
                height: 14,
                boxShadow: '0 0 16px rgba(8,90,192,0.9)',
                transform: active ? 'scale(1.35)' : 'scale(1)',
              }}
            />
            <span className="pointer-events-none absolute -top-7 whitespace-nowrap rounded bg-[#085ac0] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
              YOUR PROPERTY
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute left-4 top-4 rounded border border-[#085ac0]/40 bg-[#085ac0]/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#adc6ff] backdrop-blur">
          Radar active
        </div>

        {/* the recommendation itself — recomputed on every frame of the drag,
            so the number leads the gesture instead of reporting on it. */}
        <div className="pointer-events-none absolute bottom-4 right-4 min-w-[150px] rounded-xl border border-white/15 bg-white/95 p-3.5 text-center shadow-overlay-sm backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Tonight · Standard
          </div>
          <div className="font-display text-[32px] font-semibold leading-none tabular-nums text-[#0b1c30]">
            ${readout.rate}
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-600">
            <TrendIcon className="h-3 w-3" />
            {uplift >= 0 ? '+' : ''}
            {uplift}% · vs ${BASELINE} baseline
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-5 left-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#adc6ff]/60">
          {touched ? `Anchored by ${COMPETITORS[readout.nearest].name}` : 'Drag your property →'}
        </div>

        {/* Announced on settle rather than on every frame, so a screen reader
            isn't read a new number sixty times a second. */}
        <span className="sr-only" aria-live="polite">
          {active ? '' : `Recommended rate $${readout.rate}, ${uplift}% over the $${BASELINE} baseline.`}
        </span>
      </div>

      {/* reasoning strip — the honest states, on the marketing page too */}
      <div className="space-y-2.5 px-5 py-4 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-700">Morgan Wallen @ Nissan Stadium</span>
          <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            score 82 · major
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Vanderbilt home game</span>
          <span className="shrink-0 text-[11px] text-slate-400">too small to matter — shown anyway</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-700">Expedia listing $101</span>
          <span className="shrink-0 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
            $12 parity gap
          </span>
        </div>
      </div>
    </div>
  );
}

/** Clamp with give: inside the bounds it's 1:1, outside it resists. */
function resist(value: number, dimension: number) {
  if (value < 0) return -rubberband(-value, dimension);
  if (value > dimension) return dimension + rubberband(value - dimension, dimension);
  return value;
}
