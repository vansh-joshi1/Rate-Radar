'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GridIcon, CalendarIcon, UsersIcon, PieIcon, BellIcon, GearIcon,
  HomeIcon, LogoutIcon, MenuIcon,
} from './Icons';

const NAV = [
  { href: '/overview', label: 'Overview', Icon: GridIcon },
  { href: '/calendar', label: 'Rate Calendar', Icon: CalendarIcon },
  { href: '/competitors', label: 'Competitors', Icon: UsersIcon },
  { href: '/analytics', label: 'Analytics', Icon: PieIcon },
  { href: '/alerts', label: 'Alerts', Icon: BellIcon },
  { href: '/admin', label: 'Portfolio', Icon: HomeIcon },
  { href: '/settings', label: 'Settings', Icon: GearIcon },
];

const PROPERTIES = [
  { id: 'rri-franklin', label: 'Red Roof Inn — Franklin, TN' },
  { id: 'sunrise-cookeville', label: 'Sunrise Suites — Cookeville, TN (demo)' },
];

export default function AppShell({ children, freshness }: { children: ReactNode; freshness?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside
        className={`fixed z-40 flex h-screen w-60 flex-col border-r border-line bg-card transition-transform ${open ? '' : 'max-[820px]:-translate-x-full'}`}
      >
        <div className="border-b border-line p-5">
          <Link href="/overview" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            Rate Radar
          </Link>
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Recommends only — a human decides
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-r-[3px] border-accent bg-ink/5 text-accent'
                    : 'text-muted hover:bg-ink/5 hover:text-ink'
                }`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <div className="text-sm font-semibold">Vansh Joshi</div>
              <span className="mt-0.5 inline-block rounded-sm bg-accent-muted px-1.5 py-px text-[10px] font-extrabold uppercase text-accent">
                Pro
              </span>
            </div>
            <a href="/api/logout" title="Sign out" className="text-muted hover:text-ink">
              <LogoutIcon size={16} />
            </a>
          </div>
        </div>
      </aside>
      {/* backdrop for mobile drawer */}
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 min-[821px]:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col min-[821px]:ml-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-card px-5">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="text-ink min-[821px]:hidden"
            >
              <MenuIcon />
            </button>
            <select
              className="cursor-pointer border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink"
              defaultValue={PROPERTIES[0].id}
              title="Property"
            >
              {PROPERTIES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          {freshness && <div className="hidden text-xs text-muted sm:block">{freshness}</div>}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6 pb-24 md:p-8">{children}</main>
      </div>
    </div>
  );
}
