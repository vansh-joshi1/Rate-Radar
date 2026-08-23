'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * "How it works", scrubbed by scroll instead of asserted in three cards.
 *
 * The page claims the scoring is deterministic and inspectable, so this section
 * runs it: sources arrive, each event gets a score, the one judged too small is
 * shown and dimmed rather than dropped, and a rate lands at the end. Scroll
 * position IS the timeline — there is no playback, so scrubbing backwards
 * reverses everything for free. That is the whole reason to drive it from
 * scroll rather than from a timer.
 *
 * Rules it holds to:
 *  - the page never stops scrolling; nothing here hijacks or locks the wheel
 *  - scroll is read in a rAF, and only transform/opacity/textContent are written
 *  - React state changes three times (the active stage), never per frame
 *  - reduced motion gets a real static version, not a disabled one
 *  - before hydration the static version is what renders, so the content is
 *    readable with no JS at all
 *
 * Illustrative sample data, matching the figures used elsewhere on the page.
 */

const SOURCES = [
  { name: 'Ticketmaster', detail: '3 venues' },
  { name: 'College Football Data', detail: 'Vanderbilt' },
  { name: 'NWS alerts', detail: '2 counties' },
  { name: 'FAA', detail: 'BNA status' },
  { name: 'University + MCC calendars', detail: 'scraped' },
  { name: 'OTA listings', detail: '4 sources' },
];

type Signal = { label: string; note: string; delta: string; kind: 'base' | 'major' | 'plain' | 'rejected' };

const SIGNALS: Signal[] = [
  { label: 'Friday baseline', note: 'day-of-week curve', delta: '$94', kind: 'base' },
  { label: 'Morgan Wallen @ Nissan Stadium', note: 'score 82 · major', delta: '+18%', kind: 'major' },
  { label: 'Downtown absorbs most of the draw', note: 'distance dampener', delta: '−6%', kind: 'plain' },
  { label: 'Compset median $96', note: 'quiet-night bound', delta: 'in range', kind: 'plain' },
  { label: 'Vanderbilt home game', note: 'score 11', delta: 'too small to matter', kind: 'rejected' },
];

const STAGES = [
  { n: '1', title: 'Collect', body: 'Six public sources, seven times a day, gathered automatically.' },
  { n: '2', title: 'Score', body: 'Every signal scored and compounded — including the ones that lose.' },
  { n: '3', title: 'You decide', body: 'A rate with its reasoning attached. You set the price.' },
];

const BASELINE = 79;
const RECOMMENDED = 89;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Exponential ease-out — things arrive quickly and settle, never accelerate in. */
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Local progress of a window inside the overall 0..1 scrub. */
const window_ = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<(HTMLLIElement | null)[]>([]);
  const signalRefs = useRef<(HTMLLIElement | null)[]>([]);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railFill = useRef<HTMLSpanElement>(null);
  const rateRef = useRef<HTMLSpanElement>(null);
  const upliftRef = useRef<HTMLSpanElement>(null);
  const raf = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [stage, setStage] = useState(0);

  const draw = useCallback(() => {
    raf.current = null;
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    const p = travel > 0 ? clamp01(-rect.top / travel) : 0;

    railFill.current?.style.setProperty('height', `${p * 100}%`);

    // Stage 1 — sources arrive one at a time.
    SOURCES.forEach((_, i) => {
      const el = sourceRefs.current[i];
      if (!el) return;
      const local = easeOut(window_(p, 0.02 + i * 0.035, 0.14 + i * 0.035));
      el.style.opacity = String(local);
      el.style.transform = `translate3d(0, ${(1 - local) * 10}px, 0)`;
    });

    // Stage 2 — signals resolve in order. The rejected one arrives like the
    // rest and then stays dimmed; it is evidence, not an error.
    SIGNALS.forEach((_, i) => {
      const el = signalRefs.current[i];
      if (!el) return;
      const local = easeOut(window_(p, 0.36 + i * 0.045, 0.48 + i * 0.045));
      el.style.opacity = String(local);
      el.style.transform = `translate3d(${(1 - local) * -8}px, 0, 0)`;
    });

    // Stage 3 — the number resolves from baseline to recommendation.
    const settle = easeOut(window_(p, 0.72, 0.94));
    const value = Math.round(BASELINE + (RECOMMENDED - BASELINE) * settle);
    if (rateRef.current) rateRef.current.textContent = `$${value}`;
    if (upliftRef.current) {
      const pct = Math.round(((value - BASELINE) / BASELINE) * 100);
      upliftRef.current.textContent = `+${pct}% vs $${BASELINE} baseline`;
    }

    // Panels cross-fade; only one is legible at a time.
    const activeIdx = p < 0.33 ? 0 : p < 0.69 ? 1 : 2;
    stageRefs.current.forEach((el, i) => {
      if (!el) return;
      const on = i === activeIdx;
      el.style.opacity = on ? '1' : '0';
      el.style.transform = `translate3d(0, ${on ? 0 : 12}px, 0)`;
      el.style.pointerEvents = on ? 'auto' : 'none';
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });

    setStage((prev) => (prev === activeIdx ? prev : activeIdx));
  }, []);

  const onScroll = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    setMounted(true);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!mounted || reduced) return;
    draw();
    /* Backgrounded tabs stop servicing rAF, so a frame queued on the way out
       never resolves and the coalescing guard stays armed. Drop it on the way
       back in and redraw once from wherever the page now sits — the scroll
       position can have moved while we were away. */
    const onVisibility = () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      if (!document.hidden) draw();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [mounted, reduced, draw, onScroll]);

  const heading = (
    <div className="mx-auto max-w-[1200px] px-6">
      <h2 className="max-w-2xl font-display text-[32px] font-bold tracking-tight text-[#0b1c30] md:text-[38px]">
        Watch it reason
      </h2>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#44474d]">
        No black box. Every recommendation is the same three steps, and every step shows its arithmetic — including
        the signals it decides not to act on.
      </p>
    </div>
  );

  /* Static version: pre-hydration, no-JS, and reduced motion all land here. It
     is a real layout rather than the scrubbed one with the motion switched off. */
  if (!mounted || reduced) {
    return (
      <section id="how-it-works" className="bg-white px-6 py-24">
        {heading}
        <div className="mx-auto mt-14 grid max-w-[1200px] gap-6 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <div key={s.n} className="rounded-2xl border border-[#c4c6cd] bg-white p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#085ac0] font-display text-[14px] font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-5 font-display text-[20px] font-semibold text-[#0b1c30]">{s.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[#44474d]">{s.body}</p>
              <ul className="mt-5 space-y-1.5 border-t border-[#c4c6cd]/60 pt-4 text-[13px] text-[#44474d]">
                {i === 0 && SOURCES.map((x) => <li key={x.name}>{x.name} · {x.detail}</li>)}
                {i === 1 &&
                  SIGNALS.map((x) => (
                    <li key={x.label} className={x.kind === 'rejected' ? 'text-[#74777d]' : ''}>
                      {x.label} — {x.delta}
                    </li>
                  ))}
                {i === 2 && (
                  <>
                    <li className="font-display text-[24px] font-semibold tabular-nums text-[#0b1c30]">
                      ${RECOMMENDED}
                    </li>
                    <li>+13% vs ${BASELINE} baseline</li>
                    <li className="text-[#74777d]">Rate Radar never changes a price anywhere.</li>
                  </>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="how-it-works" className="bg-white">
      {/* The scroll distance the scrub is mapped onto. Nothing is pinned or
          hijacked — the page scrolls normally, the panel just stays put while
          it passes. */}
      <div ref={trackRef} className="relative h-[300vh]">
        <div className="sticky top-24 pb-16 pt-20">
          {heading}

          <div className="mx-auto mt-12 grid max-w-[1200px] gap-10 px-6 lg:grid-cols-[220px_1fr]">
            {/* stage rail */}
            <ol className="relative hidden lg:block">
              <span aria-hidden className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-[#c4c6cd]/70" />
              <span
                ref={railFill}
                aria-hidden
                className="absolute left-[15px] top-2 w-px bg-[#085ac0]"
                style={{ height: '0%' }}
              />
              {STAGES.map((s, i) => (
                <li key={s.n} className="relative mb-9 pl-11">
                  <span
                    className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border font-display text-[13px] font-bold transition-colors duration-300 ${
                      i <= stage
                        ? 'border-[#085ac0] bg-[#085ac0] text-white'
                        : 'border-[#c4c6cd] bg-white text-[#74777d]'
                    }`}
                  >
                    {s.n}
                  </span>
                  <h3
                    className={`font-display text-[16px] font-semibold transition-colors duration-300 ${
                      i === stage ? 'text-[#0b1c30]' : 'text-[#74777d]'
                    }`}
                  >
                    {s.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#74777d]">{s.body}</p>
                </li>
              ))}
            </ol>

            {/* the panel — Instrument Navy, because everything in it is a raw
                machine reading rather than an interpretation of one */}
            <div className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1c30]">
              <div
                aria-hidden
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, #adc6ff 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* stage 1 — collect */}
              <div
                ref={(el) => { stageRefs.current[0] = el; }}
                className="absolute inset-0 p-7 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#adc6ff]">
                  Collector run · 07:00 CT
                </div>
                <ul className="mt-5 space-y-2.5">
                  {SOURCES.map((s, i) => (
                    <li
                      key={s.name}
                      ref={(el) => { sourceRefs.current[i] = el; }}
                      className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5"
                      style={{ opacity: 0 }}
                    >
                      <span className="flex items-center gap-2.5 text-[14px] text-white">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#67dca8]" />
                        {s.name}
                      </span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wider text-[#adc6ff]/70">
                        {s.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* stage 2 — score */}
              <div
                ref={(el) => { stageRefs.current[1] = el; }}
                className="absolute inset-0 p-7 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ opacity: 0 }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#adc6ff]">
                  Scoring · Friday 14 August
                </div>
                <ul className="mt-5 space-y-2">
                  {SIGNALS.map((s, i) => (
                    <li
                      key={s.label}
                      ref={(el) => { signalRefs.current[i] = el; }}
                      className={`flex items-baseline justify-between gap-4 border-b border-white/10 pb-2.5 ${
                        s.kind === 'rejected' ? 'opacity-100' : ''
                      }`}
                      style={{ opacity: 0 }}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-[14px] ${
                            s.kind === 'rejected' ? 'text-[#75859d]' : 'text-white'
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="block text-[11px] uppercase tracking-wider text-[#adc6ff]/60">{s.note}</span>
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${
                          s.kind === 'rejected'
                            ? 'text-[11px] text-[#75859d]'
                            : s.kind === 'major'
                              ? 'text-[14px] font-semibold text-[#67dca8]'
                              : 'text-[14px] text-white'
                        }`}
                      >
                        {s.delta}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-[#75859d]">
                  The rejected line stays on screen. A recommendation you can only see the winners of is not
                  auditable.
                </p>
              </div>

              {/* stage 3 — decide */}
              <div
                ref={(el) => { stageRefs.current[2] = el; }}
                className="absolute inset-0 flex flex-col items-center justify-center p-7 text-center transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ opacity: 0 }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#adc6ff]">
                  Tonight · Standard
                </div>
                <span
                  ref={rateRef}
                  className="mt-2 font-display text-[56px] font-bold leading-none tabular-nums text-white"
                >
                  ${BASELINE}
                </span>
                <span ref={upliftRef} className="mt-3 text-[14px] font-semibold tabular-nums text-[#67dca8]">
                  +0% vs ${BASELINE} baseline
                </span>
                <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-[#adc6ff]">
                  It lands on your dashboard, and in your inbox when it matters.
                </p>
                <p className="mt-2 text-[13px] font-semibold text-white">
                  You set the price. Rate Radar never touches it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
