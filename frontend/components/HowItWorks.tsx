'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * "How it works", told as the pipeline actually runs: sources arrive, each
 * event is scored, the one judged too small stays on screen dimmed, and a rate
 * lands at the end.
 *
 * On wide screens the navy panel sticks while three invisible sentinels scroll
 * past behind it. An IntersectionObserver watches which sentinel is crossing
 * the middle of the viewport, and that is the active stage. React state changes
 * three times per pass, never per frame, and there is no scroll listener. The
 * page never stops scrolling; nothing here locks the wheel.
 *
 * Phones, reduced motion and pre-hydration all get the static version: a real
 * stacked layout, not the sticky one with motion switched off.
 *
 * Illustrative sample data from the demo world (lib/demo.ts). Source labels are
 * generic there for the same reason they are here: no real call happened.
 */

const SOURCES: { name: string; detail: string; stale?: string }[] = [
  { name: 'Events', detail: '3 venues' },
  { name: 'College sports', detail: 'home schedule' },
  { name: 'Weather alerts', detail: '2 counties' },
  { name: 'Airport status', detail: 'delays + closures' },
  { name: 'Campus + convention calendars', detail: 'scraped' },
  { name: 'Hotel prices', detail: 'compset + parity', stale: '4h old cache' },
];

type Signal = { label: string; note: string; delta: string; kind: 'base' | 'major' | 'plain' | 'rejected' };

const SIGNALS: Signal[] = [
  { label: 'Friday baseline', note: 'day-of-week', delta: '$79', kind: 'base' },
  { label: 'Neon Compass, Harborview Amphitheater', note: 'score 82, major', delta: '+18%', kind: 'major' },
  { label: 'Downtown absorbs most of the draw', note: 'distance dampener', delta: '−5%', kind: 'plain' },
  { label: 'Compset median $96', note: 'event nights are never capped', delta: 'no cap', kind: 'plain' },
  { label: 'Cascadia State home game', note: 'score 11', delta: 'Too small to matter', kind: 'rejected' },
];

const STAGES = [
  { title: 'Collect', body: 'Six sources, twice a day. A source that breaks is skipped and named, and the run carries on.' },
  { title: 'Score', body: 'Every event is scored for overflow. The ones that lose stay on screen.' },
  { title: 'Recommend', body: 'A rate with its reasoning attached. You set the price.' },
];

const BASELINE = 79;
const RECOMMENDED = 89;

/* Where each stage starts, as a fraction of the 300vh track. Uneven on purpose:
   the middle stage has the most to read. */
const BOUNDS = ['0%', '37%', '63%', '100%'];

export default function HowItWorks() {
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rateRef = useRef<HTMLSpanElement>(null);
  const [interactive, setInteractive] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia('(min-width: 1024px)');
    const sync = () => setInteractive(wide.matches && !reduced.matches);
    sync();
    reduced.addEventListener('change', sync);
    wide.addEventListener('change', sync);
    return () => {
      reduced.removeEventListener('change', sync);
      wide.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = sentinelRefs.current.indexOf(e.target as HTMLDivElement);
          if (i >= 0) setStage(i);
        });
      },
      // A one-pixel line across the middle of the viewport.
      { rootMargin: '-50% 0px -50% 0px' },
    );
    sentinelRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [interactive]);

  // The number resolves from baseline to recommendation once, on arrival.
  useEffect(() => {
    const el = rateRef.current;
    if (!el) return;
    if (stage !== 2) {
      el.textContent = `$${BASELINE}`;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / 800, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `$${Math.round(BASELINE + (RECOMMENDED - BASELINE) * eased)}`;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  const heading = (
    <div className="mx-auto w-full max-w-[1200px]">
      <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[52px]">
        Watch it reason
      </h2>
      <p className="mt-6 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
        Collect, score, recommend. Every step shows its arithmetic, including the signals it decides not to act on.
      </p>
    </div>
  );

  if (!interactive) {
    return (
      <section id="how-it-works" className="scroll-mt-24 px-4 pb-24 md:px-6 md:pb-40">
        {heading}
        <ol className="mx-auto mt-14 max-w-[1200px] space-y-12">
          {STAGES.map((s, i) => (
            <li key={s.title} className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
              <div>
                <h3 className="text-[20px] font-semibold tracking-tight text-[#0b1c30]">{s.title}</h3>
                <p className="mt-2 text-pretty text-[14.5px] leading-relaxed text-[#44474d]">{s.body}</p>
              </div>
              <div className="rounded-[2rem] bg-[#0b1c30]/[0.035] p-1.5 ring-1 ring-[#0b1c30]/[0.05]"><div className="rounded-[calc(2rem-0.375rem)] bg-[#0b1c30] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                {i === 0 && <SourceList visible />}
                {i === 1 && <SignalList visible />}
                {i === 2 && <Verdict rate={RECOMMENDED} visible />}
              </div></div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="relative h-[300vh]">
        {/* the sentinels: invisible, stacked behind the sticky panel */}
        <div aria-hidden className="absolute inset-0">
          {STAGES.map((s, i) => (
            <div
              key={s.title}
              ref={(el) => {
                sentinelRefs.current[i] = el;
              }}
              className="absolute inset-x-0"
              style={{ top: BOUNDS[i], height: `calc(${BOUNDS[i + 1]} - ${BOUNDS[i]})` }}
            />
          ))}
        </div>

        <div className="sticky top-0 flex h-[100dvh] flex-col justify-center px-6 pt-16">
          {heading}

          <div className="mx-auto mt-10 grid w-full max-w-[1200px] grid-cols-[240px_1fr] gap-12">
            {/* stage rail */}
            <ol className="relative self-start">
              <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-px bg-[#0b1c30]/[0.12]" />
              <span
                aria-hidden
                className="absolute left-[5px] top-3 w-px origin-top bg-[#085ac0] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ height: 'calc(100% - 1.5rem)', transform: `scaleY(${stage / (STAGES.length - 1)})` }}
              />
              {STAGES.map((s, i) => (
                <li key={s.title} className="relative mb-8 pl-8 last:mb-0" aria-current={i === stage ? 'step' : undefined}>
                  <span
                    aria-hidden
                    className={`absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border transition-colors duration-300 ${
                      i <= stage ? 'border-[#085ac0] bg-[#085ac0]' : 'border-[#0b1c30]/20 bg-[#f8f9ff]'
                    }`}
                  />
                  <h3
                    className={`text-[18px] font-semibold tracking-tight transition-colors duration-500 ${
                      i === stage ? 'text-[#0b1c30]' : 'text-[#44474d]/70'
                    }`}
                  >
                    {s.title}
                  </h3>
                  <p
                    className={`mt-1.5 text-[13.5px] leading-relaxed transition-colors duration-500 ${
                      i === stage ? 'text-[#44474d]' : 'text-[#44474d]/60'
                    }`}
                  >
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>

            {/* the panel: Instrument Navy, because everything in it is a raw
                machine reading rather than an interpretation of one */}
            <div className="rounded-[2rem] bg-[#0b1c30]/[0.035] p-1.5 shadow-[0_32px_64px_-32px_rgba(11,28,48,0.25)] ring-1 ring-[#0b1c30]/[0.05]"><div className="relative h-[420px] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-[#0b1c30] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] [@media(max-height:760px)]:h-[360px]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden={i !== stage}
                  className={`absolute inset-0 p-7 transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    i === stage ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  {i === 0 && <SourceList visible={stage === 0} />}
                  {i === 1 && <SignalList visible={stage === 1} />}
                  {i === 2 && <Verdict rateRef={rateRef} rate={BASELINE} visible={stage === 2} />}
                </div>
              ))}
            </div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Rows arrive one after another when their stage becomes active, and reset
   when it leaves, so scrolling back replays them in order. */
function arrive(visible: boolean, i: number) {
  return {
    className: `transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
    }`,
    style: { transitionDelay: visible ? `${i * 70}ms` : '0ms' },
  };
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-geist-mono text-[12px] text-[#adc6ff]">{children}</div>;
}

function SourceList({ visible }: { visible: boolean }) {
  return (
    <>
      <PanelLabel>Collector run, 07:00 CT</PanelLabel>
      <ul className="mt-4 divide-y divide-white/[0.08]">
        {SOURCES.map((s, i) => {
          const a = arrive(visible, i);
          return (
            <li key={s.name} className={`flex items-center justify-between gap-4 py-2.5 ${a.className}`} style={a.style}>
              <span className="min-w-0">
                <span className="block truncate text-body-md text-white">{s.name}</span>
                <span className="block text-body-sm text-[#adc6ff]/80">{s.detail}</span>
              </span>
              {s.stale ? (
                <span className="shrink-0 rounded-full bg-[#fbbf24]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#fbbf24]">
                  {s.stale}
                </span>
              ) : (
                <span className="shrink-0 text-[12px] font-medium text-[#67dca8]">Fresh</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SignalList({ visible }: { visible: boolean }) {
  return (
    <>
      <PanelLabel>Scoring, Friday</PanelLabel>
      <ul className="mt-4 divide-y divide-white/[0.08]">
        {SIGNALS.map((s, i) => {
          const a = arrive(visible, i);
          const rejected = s.kind === 'rejected';
          return (
            <li key={s.label} className={`flex items-baseline justify-between gap-4 py-2.5 ${a.className}`} style={a.style}>
              <span className="min-w-0">
                <span className={`block truncate text-body-md ${rejected ? 'text-[#9ba4b4]' : 'text-white'}`}>
                  {s.label}
                </span>
                <span className="block text-body-sm text-[#adc6ff]/70">{s.note}</span>
              </span>
              {rejected ? (
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium bg-white/[0.06] text-[#9ba4b4]">
                  {s.delta}
                </span>
              ) : (
                <span
                  className={`shrink-0 font-geist-mono text-[13px] tabular-nums ${
                    s.kind === 'major' ? 'font-semibold text-[#67dca8]' : 'text-white'
                  }`}
                >
                  {s.delta}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Verdict({
  rate,
  visible,
  rateRef,
}: {
  rate: number;
  visible: boolean;
  rateRef?: React.RefObject<HTMLSpanElement>;
}) {
  const a = arrive(visible, 0);
  const b = arrive(visible, 3);
  return (
    <div className="grid h-full grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-10">
      <div>
        <PanelLabel>Tonight, Standard</PanelLabel>
        <span ref={rateRef} className="mt-3 block text-[72px] font-semibold leading-none tracking-tighter tabular-nums text-white">
          ${rate}
        </span>
        <span className="mt-3 block font-geist-mono text-[13px] tabular-nums text-[#67dca8]">
          +{Math.round(((RECOMMENDED - BASELINE) / BASELINE) * 100)}% vs ${BASELINE} baseline, range $84 to $94
        </span>
        <div className={`mt-8 max-w-sm ${a.className}`} style={a.style}>
          <p className="text-body-md text-[#adc6ff]">
            It lands on the dashboard every morning, and in your inbox when the number moves.
          </p>
        </div>
        <p className={`mt-2 text-body-md font-semibold text-white ${b.className}`} style={b.style}>
          You set the price. Rate Radar never touches it.
        </p>
      </div>
      <AlertEmail visible={visible} />
    </div>
  );
}

/* The alert as it reaches the owner's inbox, arriving once the number has
   settled: this is what "in your inbox when the number moves" means. The
   subject is the demo world's own alert (lib/demo.ts). */
function AlertEmail({ visible }: { visible: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 text-left shadow-[0_24px_48px_-24px_rgba(2,6,14,0.6)] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.98] opacity-0'
      }`}
      style={{ transitionDelay: visible ? '950ms' : '0ms' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#085ac0]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M19.07 4.93a10 10 0 1 0 2.5 4.07" />
              <path d="M15.5 8.5a5 5 0 1 0 1.9 3.1" />
              <path d="M12 12 20 4" />
            </svg>
          </span>
          <span className="text-[13px] font-semibold text-[#1a1b20]">Rate Radar</span>
        </span>
        <span className="font-geist-mono text-[11.5px] text-[#44474d]">07:02</span>
      </div>
      <p className="mt-4 text-balance text-[14.5px] font-semibold leading-snug text-[#0b1c30]">
        Friday: recommended rate moved $84 &rarr; $89
      </p>
      <p className="mt-2 text-pretty text-[13px] leading-relaxed text-[#44474d]">
        Neon Compass at Harborview Amphitheater is a major event. Downtown absorbs part of the draw.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#0b1c30]/[0.06] pt-3">
        <span className="font-geist-mono text-[12px] tabular-nums text-[#029768]">+$5, 3 reasons</span>
        <span className="text-[12px] text-[#44474d]">Nothing was changed</span>
      </div>
    </div>
  );
}
