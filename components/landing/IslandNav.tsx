'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowUpRight';
import { RadarIcon } from '../RadarMark';

/*
 * The landing's floating island nav: a glass pill detached from the top edge.
 * Blur is allowed here because the pill is fixed, never scrolling content.
 *
 * Desktop: logo, section links with scroll-spy (the current section reads in
 * Signal Cobalt, "where you are" being one of the things the Verdict Rule
 * lets cobalt mean), Sign in, and the demo CTA.
 * Phone: logo and a hamburger whose two lines rotate into an X. It opens a
 * screen-filling glass overlay whose links rise out of clipped boxes one after
 * another. Escape closes it, focus moves into it, and the page behind stops
 * scrolling while it is open.
 *
 * Layers: overlay z-30 < pill z-40 < skip link z-50 (app/page.tsx).
 */

const LINKS = [
  { id: 'readings', label: 'What you see' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
];

const SPRING = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
const ring =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function IslandNav() {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        setCurrent(LINKS.find((l) => visible.has(l.id))?.id ?? null);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLink.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onWide = () => window.innerWidth >= 768 && setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onWide);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onWide);
    };
  }, [open]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <div
          className={`pointer-events-auto flex w-full max-w-[1200px] items-center justify-between gap-6 rounded-full bg-white/70 py-1.5 pl-5 pr-1.5 shadow-[0_12px_40px_-16px_rgba(11,28,48,0.22)] ring-1 ring-[#0b1c30]/[0.06] backdrop-blur-xl md:w-max md:max-w-none`}
        >
          <Link href="/" className={`flex items-center gap-2 rounded-full ${ring}`} onClick={() => setOpen(false)}>
            <RadarIcon className="h-5 w-5 text-[#085ac0]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-7 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                aria-current={current === l.id ? 'location' : undefined}
                className={`rounded-full text-[13px] font-medium transition-colors duration-300 ${SPRING} ${ring} ${
                  current === l.id ? 'text-[#085ac0]' : 'text-[#44474d] hover:text-[#0b1c30]'
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            <Link href="/login" className={`rounded-full text-[13px] font-medium text-[#44474d] transition-colors hover:text-[#0b1c30] ${ring}`}>
              Sign in
            </Link>
            <Link
              href="/demo"
              className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#085ac0] py-1 pl-4 pr-1 text-[13px] font-medium text-white transition-[transform,background-color] duration-500 ${SPRING} hover:bg-[#06489c] active:scale-[0.98] ${ring}`}
            >
              Open the demo
              <span
                aria-hidden
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ${SPRING} group-hover:-translate-y-[1px] group-hover:translate-x-0.5 group-hover:scale-105`}
              >
                <ArrowUpRightIcon weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          {/* hamburger: two lines that rotate about their shared centre into an X */}
          <button
            ref={toggle}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="island-menu"
            onClick={() => setOpen((o) => !o)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-[#0b1c30]/[0.05] md:hidden ${ring}`}
          >
            <span
              aria-hidden
              className={`absolute h-px w-4 bg-[#0b1c30] transition-transform duration-500 ${SPRING} motion-reduce:transition-none ${
                open ? 'rotate-45' : '-translate-y-[3px]'
              }`}
            />
            <span
              aria-hidden
              className={`absolute h-px w-4 bg-[#0b1c30] transition-transform duration-500 ${SPRING} motion-reduce:transition-none ${
                open ? '-rotate-45' : 'translate-y-[3px]'
              }`}
            />
          </button>
        </div>
      </header>

      {/* phone menu overlay */}
      <div
        id="island-menu"
        aria-hidden={!open}
        // React 18's types predate `inert`; as a plain attribute it keeps the
        // closed menu's links out of the tab order.
        {...({ inert: open ? undefined : '' } as Record<string, string | undefined>)}
        className={`fixed inset-0 z-30 flex flex-col justify-center bg-white/80 px-6 backdrop-blur-3xl transition-opacity duration-500 ${SPRING} motion-reduce:transition-none md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ul className="space-y-2">
          {[...LINKS.map((l) => ({ href: `#${l.id}`, label: l.label })), { href: '/login', label: 'Sign in' }].map((l, i) => (
            <li key={l.href} className="overflow-hidden">
              <a
                ref={i === 0 ? firstLink : undefined}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg py-1 text-[40px] font-semibold leading-tight tracking-tighter text-[#0b1c30] transition-[transform,opacity] duration-700 ${SPRING} motion-reduce:transition-none ${ring} ${
                  open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                }`}
                style={{ transitionDelay: open ? `${100 + i * 50}ms` : '0ms' }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div
          className={`mt-10 transition-[transform,opacity] duration-700 ${SPRING} motion-reduce:transition-none ${
            open ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
          style={{ transitionDelay: open ? '320ms' : '0ms' }}
        >
          <Link
            href="/demo"
            onClick={() => setOpen(false)}
            className={`group inline-flex items-center gap-3 rounded-full bg-[#085ac0] py-1.5 pl-6 pr-1.5 text-[15px] font-medium text-white active:scale-[0.98] ${ring}`}
          >
            Open the demo
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <ArrowUpRightIcon weight="light" className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
