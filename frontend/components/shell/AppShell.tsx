'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ListIcon } from '@phosphor-icons/react/dist/ssr/List';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import { BellIcon } from '@phosphor-icons/react/dist/ssr/Bell';
import { SquaresFourIcon } from '@phosphor-icons/react/dist/ssr/SquaresFour';
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/ssr/ChartLineUp';
import { CalendarDotsIcon } from '@phosphor-icons/react/dist/ssr/CalendarDots';
import { CallBellIcon } from '@phosphor-icons/react/dist/ssr/CallBell';
import { GearSixIcon } from '@phosphor-icons/react/dist/ssr/GearSix';
import { SignOutIcon } from '@phosphor-icons/react/dist/ssr/SignOut';
import { BuildingsIcon } from '@phosphor-icons/react/dist/ssr/Buildings';
import { CaretUpDownIcon } from '@phosphor-icons/react/dist/ssr/CaretUpDown';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { RadarIcon } from '../RadarMark';
import { PillCta, SPRING } from '../landing/Machined';
import { resetAnalytics } from '../PostHogInit';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]';

/*
 * App chrome on the Machined Instrument language (DESIGN.md): a 280px rail
 * with the brand lockup, property switcher and pill nav; a 64px top bar with
 * section links, page jumper, alerts and account. Geist, Phosphor Light, and
 * the landing's hex values directly, like every other migrated surface.
 *
 * The shell also sets the Geist font variables for everything inside it, so a
 * page that migrates only needs `font-geist` on its root.
 */

const NAV = [
  { href: '/overview', label: 'Dashboard', icon: SquaresFourIcon },
  { href: '/competitors', label: 'Competitor insights', icon: ChartLineUpIcon },
  { href: '/calendar', label: 'Market intelligence', icon: CalendarDotsIcon },
  { href: '/analytics', label: 'Bellhop', icon: CallBellIcon },
];

const TOP_NAV = [
  { href: '/admin', label: 'Portfolio' },
  { href: '/calendar', label: 'Monthly view' },
  { href: '/alerts', label: 'System health' },
];

export interface ShellProperty {
  id: string;
  label: string;
  sub: string;
}

/** The real deployment's switcher. A demo passes its own invented list instead. */
const DEFAULT_PROPERTIES: ShellProperty[] = [
  { id: 'rri-franklin', label: 'Red Roof Inn', sub: 'Franklin, TN' },
];

/* The search box is a page jumper rather than a decorative input — it matches
   the nav labels and routes on Enter. */
const SEARCH_TARGETS = [
  ...NAV.map((n) => ({ href: n.href, label: n.label })),
  ...TOP_NAV,
  { href: '/settings', label: 'Settings' },
  { href: '/competitors', label: 'Rates' },
  { href: '/admin', label: 'Properties' },
];

interface ShellUser {
  name: string;
  email?: string;
  role: string;
}

function initials(name: string): string {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

export default function AppShell({
  children,
  freshness,
  user,
  alerts = 0,
  properties = DEFAULT_PROPERTIES,
  isDemo = false,
}: {
  children: ReactNode;
  freshness?: string;
  user?: ShellUser | null;
  /** Unhealthy collector sources — drives the notification dot. */
  alerts?: number;
  /** Switcher entries. A demo sandbox supplies invented ones so the real
   *  property is never named on a page a stranger can open. */
  properties?: ShellProperty[];
  /** Swaps session-only chrome (sign out) for sandbox equivalents. */
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(properties[0].id);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const property = properties.find((p) => p.id === propertyId) ?? properties[0];
  const switcherRef = useRef<HTMLDivElement>(null);

  // Escape closes whichever layer is open, innermost first; a click outside
  // the switcher closes it. Listeners exist only while something is open.
  useEffect(() => {
    if (!open && !switcherOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (switcherOpen) setSwitcherOpen(false);
      else setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (switcherOpen && !switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, switcherOpen]);

  function jump(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = SEARCH_TARGETS.find((t) => t.label.toLowerCase().includes(q));
    if (hit) {
      router.push(hit.href);
      setQuery('');
    }
  }

  // Pills, because they can be pressed (DESIGN.md → The Pill-Or-Panel Rule).
  // The 4px hover nudge is the rail's one bit of motion; it stops under
  // reduced motion while the colour change still registers.
  const navLink = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-full px-3.5 py-2 text-[14.5px] font-medium transition-[transform,background-color,color] duration-500 ${SPRING} hover:translate-x-1 motion-reduce:transition-none motion-reduce:hover:translate-x-0 ${FOCUS} ${
      active
        ? 'bg-[#e5eeff] text-[#085ac0]'
        : 'text-[#44474d] hover:bg-[#0b1c30]/[0.04] hover:text-[#1a1b20]'
    }`;
  const iconWeight = (active: boolean) => (active ? 'regular' : 'light');

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} flex min-h-[100dvh] bg-paper`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[#085ac0] focus:px-4 focus:py-2 focus:font-geist focus:text-[13px] focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      {/* 300ms, not Tailwind's default 150ms: a drawer travelling a full 280px
          in 150ms reads as a glitch rather than a movement. The curve is the
          system's one spring: fast out of the gate, long settle. */}
      <nav
        aria-label="App"
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-sidebar-width flex-col border-r border-[#0b1c30]/[0.06] bg-[#f8f9ff] font-geist text-[#1a1b20] antialiased transition-[transform,visibility] duration-300 ${SPRING} motion-reduce:duration-150 ${
          open ? 'max-md:shadow-[0_12px_40px_-16px_rgba(11,28,48,0.22)]' : 'max-md:invisible max-md:-translate-x-full'
        }`}
      >
        {/* Brand: the same lockup as the landing's island, sized to the 64px top bar. */}
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/overview" className={`flex items-center gap-2 rounded-full ${FOCUS}`}>
            <RadarIcon className="h-5 w-5 text-[#085ac0]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </Link>
        </div>

        {/* Property switcher. Cobalt on the badge because this is the user's own property. */}
        <div ref={switcherRef} className="relative px-3 pt-4">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-expanded={switcherOpen}
            aria-haspopup="true"
            className={`group flex w-full items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-left ring-1 ring-[#0b1c30]/[0.08] transition-[transform,background-color] duration-500 ${SPRING} hover:bg-[#f3f5fc] active:scale-[0.98] motion-reduce:transition-none ${FOCUS}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5eeff] text-[#085ac0]">
              <BuildingsIcon weight="light" className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-geist-mono text-[11.5px] leading-tight text-[#44474d]">Property</span>
              <span className="block truncate text-[14px] font-semibold leading-snug">{property.label}</span>
            </span>
            <CaretUpDownIcon weight="light" className="h-4 w-4 shrink-0 text-[#44474d]" />
          </button>

          {switcherOpen && (
            <div className="absolute left-3 right-3 z-50 mt-2 rounded-[1.25rem] bg-white p-1.5 shadow-[0_12px_40px_-16px_rgba(11,28,48,0.22)] ring-1 ring-[#0b1c30]/[0.06]">
              {properties.map((p) => {
                const current = p.id === propertyId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPropertyId(p.id);
                      setSwitcherOpen(false);
                    }}
                    aria-current={current ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-[calc(1.25rem-0.375rem)] px-3 py-2 text-left transition-colors duration-150 hover:bg-[#0b1c30]/[0.04] ${FOCUS}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{p.label}</span>
                      <span className="block truncate text-[12.5px] text-[#44474d]">{p.sub}</span>
                    </span>
                    {current && <CheckIcon weight="regular" className="h-4 w-4 shrink-0 text-[#085ac0]" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ul className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map(({ href, label, icon: NavIcon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={label}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={navLink(active)}
                >
                  <NavIcon weight={iconWeight(active)} className="h-5 w-5 shrink-0" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-5 h-px bg-[#0b1c30]/[0.06]" />
        <ul className="flex flex-col gap-1 px-3 py-4">
          <li>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
              className={navLink(pathname.startsWith('/settings'))}
            >
              <GearSixIcon weight={iconWeight(pathname.startsWith('/settings'))} className="h-5 w-5 shrink-0" aria-hidden />
              Settings
            </Link>
          </li>
          <li>
            {/* A demo visitor has no session to sign out of: `signOut()` would
                leave the demo cookie in place and bounce them to a login screen
                they never used. The way out of a sandbox is to leave the sandbox. */}
            {isDemo ? (
              <a href="/demo/exit" className={navLink(false)}>
                <SignOutIcon weight="light" className="h-5 w-5 shrink-0" aria-hidden />
                Exit demo
              </a>
            ) : (
              <button onClick={() => { resetAnalytics(); fetch('/api/auth/signout', { method: 'POST' }).finally(() => (window.location.href = '/login')); }} className={navLink(false)}>
                <SignOutIcon weight="light" className="h-5 w-5 shrink-0" aria-hidden />
                Sign out
              </button>
            )}
          </li>
        </ul>
      </nav>

      {/* Always mounted, opacity-toggled. It used to be conditionally rendered,
          which made its exit impossible to animate — the drawer slid away while
          the scrim vanished in a single frame. Closed state is inert:
          pointer-events off, out of the tab order, hidden from AT. */}
      <button
        aria-label="Close menu"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-[#0b1c30]/30 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-150 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div className="flex min-w-0 flex-1 flex-col md:ml-sidebar-width">
        {/* The top bar is on the Machined Instrument language (DESIGN.md);
            the rail beside it has not migrated yet. A solid canvas rather than
            a blur: it is sticky over scrolling content. */}
        <header className="sticky top-0 z-40 w-full bg-[#f8f9ff] font-geist text-[#1a1b20] antialiased">
          <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[#44474d] transition-colors duration-150 hover:bg-[#0b1c30]/[0.05] hover:text-[#1a1b20] md:hidden ${FOCUS}`}
            >
              <ListIcon weight="light" className="h-5 w-5" />
            </button>

            <nav aria-label="Sections" className="hidden lg:block">
              <ul className="flex items-center gap-0.5 rounded-full bg-white p-1 ring-1 ring-[#0b1c30]/[0.06]">
                {TOP_NAV.map(({ href, label }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors duration-150 ${FOCUS} ${
                          active ? 'bg-[#e5eeff] text-[#085ac0]' : 'text-[#44474d] hover:text-[#1a1b20]'
                        }`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex-1" />

            {freshness && (
              <span className="hidden whitespace-nowrap font-geist-mono text-[12px] text-[#44474d] 2xl:block">
                {freshness}
              </span>
            )}

            <form onSubmit={jump} role="search" className="group relative hidden xl:block">
              <MagnifyingGlassIcon
                weight="light"
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#44474d] transition-colors duration-150 group-focus-within:text-[#085ac0]"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a page"
                aria-label="Jump to a page"
                className="h-10 w-60 rounded-full bg-white pl-10 pr-4 text-[14px] text-[#1a1b20] shadow-[inset_0_1px_2px_rgba(11,28,48,0.06)] outline-none ring-1 ring-[#0b1c30]/[0.12] transition-shadow duration-150 placeholder:text-[#44474d] focus:ring-2 focus:ring-[#085ac0]/60"
              />
            </form>

            <Link
              href="/alerts"
              aria-label={alerts > 0 ? `Alerts: ${alerts} source${alerts === 1 ? '' : 's'} need attention` : 'Alerts'}
              title={alerts > 0 ? `${alerts} source(s) need attention` : 'Alerts'}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#44474d] transition-[transform,background-color,color] duration-500 ${SPRING} hover:bg-[#0b1c30]/[0.05] hover:text-[#1a1b20] active:scale-[0.96] motion-reduce:transition-none ${FOCUS}`}
            >
              <BellIcon weight="light" className="h-5 w-5" />
              {/* Real collector health, not decoration: drawn only when a source failed. */}
              {alerts > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ba1a1a] ring-2 ring-[#f8f9ff]" />
              )}
            </Link>

            {/* Rate entry lives in Settings → Property; this is the shortcut
                to it, not a control that writes prices anywhere itself. */}
            <span className="hidden sm:block">
              <PillCta href="/settings" size="sm">
                Update rates
              </PillCta>
            </span>

            <span
              title={user?.email ?? user?.name}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5eeff] text-[13px] font-semibold text-[#085ac0]"
            >
              {initials(user?.name ?? '?')}
            </span>
          </div>
          <div className="mx-4 h-px bg-[#0b1c30]/[0.06] md:mx-6 lg:mx-8" />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 space-y-xl outline-none p-md md:p-lg lg:p-xl">{children}</main>
      </div>
    </div>
  );
}
