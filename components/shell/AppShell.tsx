'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

/*
 * App chrome, built to the executive-dashboard design: a 280px rail with the
 * brand block, property switcher and icon nav; a 20-tall top bar with section
 * links, search, notifications and account.
 *
 * Colors come from the design tokens (globals.css) rather than hardcoded hex,
 * so pages not yet redesigned still sit coherently inside this chrome.
 */

const Icon = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`} {...(fill ? { 'data-weight': 'fill' } : {})} aria-hidden>
    {name}
  </span>
);

const NAV = [
  { href: '/overview', label: 'Dashboard', icon: 'dashboard' },
  { href: '/competitors', label: 'Competitor Insights', icon: 'query_stats' },
  { href: '/calendar', label: 'Market Intelligence', icon: 'event_note' },
  { href: '/analytics', label: 'AI Strategy', icon: 'auto_awesome' },
];

const TOP_NAV = [
  { href: '/admin', label: 'Portfolio' },
  { href: '/calendar', label: 'Monthly View' },
  { href: '/alerts', label: 'System Health' },
];

const PROPERTIES = [
  { id: 'rri-franklin', label: 'Red Roof Inn', sub: 'Franklin, TN' },
  { id: 'sunrise-cookeville', label: 'Sunrise Suites', sub: 'Cookeville, TN (demo)' },
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
}: {
  children: ReactNode;
  freshness?: string;
  user?: ShellUser | null;
  /** Unhealthy collector sources — drives the notification dot. */
  alerts?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(PROPERTIES[0].id);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const property = PROPERTIES.find((p) => p.id === propertyId) ?? PROPERTIES[0];

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

  const navLink = (active: boolean) =>
    `nav-link flex items-center gap-md px-md py-sm ${
      active
        ? 'text-accent font-bold bg-accent/10 border-r-4 border-accent rounded-l-lg'
        : 'text-muted hover:bg-paper hover:text-ink rounded-lg'
    }`;

  return (
    <div className="flex min-h-screen bg-paper">
      <nav
        className={`fixed left-0 top-0 z-50 flex h-screen w-sidebar-width flex-col border-r border-line bg-card py-lg transition-transform ${
          open ? '' : 'max-md:-translate-x-full'
        }`}
      >
        {/* brand */}
        <div className="mb-xl px-lg">
          <Link href="/overview" className="flex items-center gap-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-paper text-ink">
              <Icon name="domain" />
            </span>
            <span>
              <span className="block font-headline-md text-headline-md font-bold text-ink">Rate Radar</span>
              <span className="block font-label-md text-label-md text-muted">Revenue Management</span>
            </span>
          </Link>
        </div>

        {/* property switcher */}
        <div className="relative mb-md px-md">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-expanded={switcherOpen}
            className="group flex w-full items-center justify-between rounded-lg border border-line bg-card px-md py-sm transition-colors hover:border-accent"
          >
            <span className="flex min-w-0 items-center gap-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/10 text-accent">
                <Icon name="apartment" className="text-[18px]" />
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-label-md text-[10px] uppercase tracking-wider text-muted">
                  Current Property
                </span>
                <span className="block truncate font-body-md text-body-md font-bold text-ink">
                  {property.label}
                </span>
              </span>
            </span>
            <Icon name="unfold_more" className="text-muted transition-colors group-hover:text-accent" />
          </button>

          {switcherOpen && (
            <div className="absolute left-md right-md z-50 mt-1 overflow-hidden rounded-lg border border-line bg-card shadow-lg">
              {PROPERTIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPropertyId(p.id);
                    setSwitcherOpen(false);
                  }}
                  className={`block w-full px-md py-sm text-left transition-colors hover:bg-accent/10 ${
                    p.id === propertyId ? 'bg-accent/10' : ''
                  }`}
                >
                  <span className="block font-body-md text-body-md font-bold text-ink">{p.label}</span>
                  <span className="block text-xs text-muted">{p.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-md flex flex-1 flex-col gap-sm overflow-y-auto">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={label} href={href} onClick={() => setOpen(false)} className={navLink(active)}>
                <Icon name={icon} fill={active} />
                <span className="font-label-md text-label-md uppercase">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-sm border-t border-line pt-md">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className={navLink(pathname.startsWith('/settings'))}
          >
            <Icon name="settings" />
            <span className="font-label-md text-label-md uppercase">Settings</span>
          </Link>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className={`${navLink(false)} w-full`}>
            <Icon name="logout" />
            <span className="font-label-md text-label-md uppercase">Sign out</span>
          </button>
        </div>
      </nav>

      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col md:ml-sidebar-width">
        <header className="sticky top-0 z-40 w-full bg-paper">
          <div className="flex h-20 items-center justify-between px-md md:px-xl">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="mr-sm text-muted md:hidden"
            >
              <Icon name="menu" />
            </button>

            <div className="hidden items-center gap-lg md:flex">
              {TOP_NAV.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`font-label-md text-label-md uppercase transition-colors duration-200 ${
                      active
                        ? 'border-b-2 border-accent pb-1 font-bold text-accent'
                        : 'text-muted hover:text-accent'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="flex-1 md:hidden" />

            <div className="flex items-center gap-md">
              <form onSubmit={jump} className="group relative hidden lg:block">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search data..."
                  aria-label="Search"
                  className="w-64 rounded-full border border-line bg-card py-2 pl-10 pr-4 font-body-md text-body-md text-ink outline-none transition-all duration-300 focus:w-72 focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </form>

              {freshness && (
                <span className="hidden max-w-[200px] truncate text-xs text-muted xl:block">{freshness}</span>
              )}

              <Link
                href="/alerts"
                aria-label="Alerts"
                title={alerts > 0 ? `${alerts} source(s) need attention` : 'Alerts'}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-200 hover:scale-105 hover:bg-paper hover:text-accent active:scale-95"
              >
                <Icon name="notifications" />
                {alerts > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bad" />}
              </Link>

              <Link
                href="/admin"
                aria-label="Portfolio"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-200 hover:scale-105 hover:bg-paper hover:text-accent active:scale-95 sm:flex"
              >
                <Icon name="apps" />
              </Link>

              {/* Rate entry lives in Settings → Property; this is the shortcut
                  to it, not a control that writes prices anywhere itself. */}
              <Link
                href="/settings"
                className="ml-sm rounded bg-accent px-lg py-2 font-label-md text-label-md text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md active:translate-y-0"
              >
                Update Rates
              </Link>

              <span
                title={user?.email ?? user?.name}
                className="ml-sm flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-accent/10 text-[12px] font-bold text-accent transition-all duration-200 hover:ring-2 hover:ring-accent hover:ring-offset-2"
              >
                {initials(user?.name ?? '?')}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-xl p-md md:p-lg lg:p-xl">{children}</main>
      </div>
    </div>
  );
}
