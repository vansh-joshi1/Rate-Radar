'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BuildingsIcon } from '@phosphor-icons/react/dist/ssr/Buildings';
import { CreditCardIcon } from '@phosphor-icons/react/dist/ssr/CreditCard';
import { UsersThreeIcon } from '@phosphor-icons/react/dist/ssr/UsersThree';
import { BellSimpleIcon } from '@phosphor-icons/react/dist/ssr/BellSimple';
import { PlugsConnectedIcon } from '@phosphor-icons/react/dist/ssr/PlugsConnected';
import { InfoIcon } from '@phosphor-icons/react/dist/ssr/Info';
import BaselineEditor from './BaselineEditor';
import TeamManager from './TeamManager';
import CurrentRatesCard from './CurrentRates';
import { Bezel } from './landing/Machined';
import { Code, DIVIDER, FOCUS, Footnote, MONO_LABEL, PanelHead, StatusChip, type Tone } from './settings/parts';

/*
 * Settings, on the Machined Instrument language (DESIGN.md).
 *
 * A pill tab bar over panels in double-bezel enclosures. The open tab lives in
 * the URL hash, so /settings#team opens Team (the read-only notes elsewhere
 * point there) and the back button steps between tabs. Arrow keys move along
 * the tab bar.
 *
 * Two panels depart from the original mock's content, for the same reason as
 * elsewhere:
 *
 *   - Integrations. The mock listed "Opera Cloud PMS" and "SiteMinder" as
 *     connected. This product has no PMS integration and its core promise is
 *     that it never writes a price anywhere, so those cards would be a flat
 *     fabrication on the one page people trust for configuration. The panel
 *     shows the integrations that genuinely exist, the collector's data
 *     sources, with their real health from the last run.
 *
 *   - Notifications. The mock had toggles. Alert rules live in
 *     lib/alerts/rules.ts with no store or endpoint behind them, so a toggle
 *     would flip, look saved, and change nothing about what lands in an inbox.
 *     The panel states the thresholds that actually fire instead.
 */

const TABS = [
  { id: 'property', label: 'Property and rates', Icon: BuildingsIcon },
  { id: 'billing', label: 'Billing', Icon: CreditCardIcon },
  { id: 'team', label: 'Team', Icon: UsersThreeIcon },
  { id: 'notifications', label: 'Notifications', Icon: BellSimpleIcon },
  { id: 'integrations', label: 'Integrations', Icon: PlugsConnectedIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];
const isTab = (s: string): s is TabId => TABS.some((t) => t.id === s);

export interface SourceHealth {
  source: string;
  status: string;
  error?: string;
  fetchedAt: string;
}

export interface Thresholds {
  rateDeltaUsd: number;
  rateDeltaPct: number;
  parityGapUsd: number;
  parityGapPct: number;
  newEventMinScore: number;
  holidayLookaheadDays: number;
  sourceFailThreshold: number;
  dedupeHours: number;
}

/** Search-budget state from the last collector run, see collector/budget.ts. */
export interface SearchBudget {
  tier: 'full' | 'reduced' | 'minimal';
  spent: number;
  remaining: number;
  usedThisMonth: number;
  perMonth?: number;
  renewalDate?: string;
  skipped: { date: string; reason: string }[];
  notFound: string[];
  unavailable: string[];
}

interface Props {
  property: { id: string; name: string; city: string; timezone: string; lat: number; lng: number };
  tiers: { tierId: string; label: string }[];
  sources: SourceHealth[];
  budget?: SearchBudget;
  thresholds: Thresholds;
  invoices: { date: string; amount: string; status: string }[];
  isDemo: boolean;
}

const TIER_COPY: Record<SearchBudget['tier'], { label: string; detail: string; tone: Tone }> = {
  full: {
    label: 'Full coverage',
    detail: 'All five nights priced each morning, parity with them, and tonight priced again at midday.',
    tone: 'ok',
  },
  reduced: {
    label: 'Reduced: shorter horizon',
    detail: 'Tonight and tomorrow only, plus parity. Nights three to five are not priced until the budget recovers.',
    tone: 'warn',
  },
  minimal: {
    label: 'Minimal: tonight only',
    detail: 'One search a day. No parity and no forward nights. Pause manual runs or raise the plan.',
    tone: 'warn',
  },
};

const relative = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

/** Human names for the collector's sources: what it is, and what it feeds. */
const SOURCE_LABEL: Record<string, { name: string; feeds: string }> = {
  ticketmaster: { name: 'Ticketmaster', feeds: 'Concerts and shows' },
  cfbd: { name: 'College Football Data', feeds: 'Vanderbilt games' },
  nws: { name: 'National Weather Service', feeds: 'Weather alerts' },
  faa: { name: 'FAA', feeds: 'BNA airport status' },
  calendars: { name: 'University and convention calendars', feeds: 'Campus and convention dates' },
  rates: { name: 'SerpApi', feeds: 'Competitor prices and channel parity' },
  // The demo's sources are generic on purpose (lib/demo.ts names no real
  // provider), so they get plain names rather than a raw id.
  'events-api': { name: 'Events feed', feeds: 'Concerts, shows and conventions' },
  'college-sports': { name: 'College sports feed', feeds: 'Home games' },
  'weather-alerts': { name: 'Weather alerts feed', feeds: 'Active advisories' },
  'hotel-prices': { name: 'Hotel price feed', feeds: 'Competitor prices and channel parity' },
};

const PANEL = 'space-y-6 p-6 md:p-8';

export default function SettingsView({ property, tiers, sources, budget, thresholds, invoices, isDemo }: Props) {
  const [tab, setTab] = useState<TabId>('property');
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  // The hash is the source of truth, so links and the back button both work.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTab(h);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const choose = (id: TabId, focus = false) => {
    setTab(id);
    if (window.location.hash.slice(1) !== id) window.history.pushState(null, '', `#${id}`);
    if (focus) tabRefs.current.get(id)?.focus();
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(TABS[next].id, true);
  };

  const healthy = sources.filter((s) => s.status === 'ok').length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-tighter md:text-[40px]">Settings</h1>
        <p className="mt-2 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
          Your property, the rates the recommendations start from, who can sign in, and where the data comes from.
        </p>
      </header>

      {/* Sticky under the 64px top bar so it stays reachable while a long
          panel scrolls; scrolls sideways on narrow screens rather than
          wrapping into a ragged second row. Solid, not blurred: it scrolls
          over content (DESIGN.md → the Blur-Is-Fixed Rule). */}
      <div className="sticky top-16 z-30 -mx-1 bg-[#f8f9ff] px-1 py-2">
        <div
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={onTabKey}
          className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-[#0b1c30]/[0.08] shadow-[0_12px_32px_-20px_rgba(11,28,48,0.35)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                ref={(node) => {
                  if (node) tabRefs.current.set(id, node);
                }}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] motion-reduce:transition-none ${FOCUS} ${
                  on ? 'bg-[#e5eeff] text-[#085ac0]' : 'text-[#44474d] hover:bg-[#0b1c30]/[0.04] hover:text-[#1a1b20]'
                }`}
              >
                <Icon weight={on ? 'regular' : 'light'} aria-hidden className="h-[18px] w-[18px]" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-6">
        {tab === 'property' && (
          <>
            <Bezel core={PANEL}>
              <PanelHead title="Property profile">
                <StatusChip title="Set in lib/properties.ts">Set in code</StatusChip>
              </PanelHead>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Fact label="Property name">{property.name}</Fact>
                <Fact label="Location">{property.city}</Fact>
                <Fact label="Time zone">{property.timezone.replace(/_/g, ' ')}</Fact>
                <Fact label="Coordinates" mono>
                  {property.lat.toFixed(4)}, {property.lng.toFixed(4)}
                </Fact>
              </dl>
              <div className={DIVIDER} />
              <Footnote>
                The property registry is configured in code (<Code>lib/properties.ts</Code>) because every stored record
                is keyed by property id, and renaming one here would orphan its history. The rates below are yours to
                edit.
              </Footnote>
            </Bezel>

            <Bezel core={PANEL}>
              <PanelHead title="Room tiers and baseline rates" />
              <BaselineEditor propertyId={property.id} />
            </Bezel>

            <Bezel core={PANEL}>
              <PanelHead title="Your current rates" />
              <CurrentRatesCard propertyId={property.id} tiers={tiers} />
            </Bezel>
          </>
        )}

        {tab === 'billing' && (
          <Bezel core={PANEL}>
            <PanelHead title="Billing and subscription">
              {isDemo && <StatusChip title="Rendered from sample data, not a live feed">Sample data</StatusChip>}
            </PanelHead>

            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
              <Fact label="Plan" big>
                One property
                <span className="mt-1 block text-[14px] font-normal tracking-normal text-[#44474d]">$99 a month</span>
              </Fact>
              <Fact label="Next invoice" big>
                <span className="text-[#44474d]">None</span>
                <span className="mt-1 block text-[14px] font-normal tracking-normal text-[#44474d]">
                  No payment provider connected
                </span>
              </Fact>
              <Fact label="Payment method" big>
                Test card
                <span className="mt-1 block text-[14px] font-normal tracking-normal text-[#44474d]">
                  Stripe, ending <span className="font-geist-mono tabular-nums">4242</span>
                </span>
              </Fact>
            </dl>

            <div className={DIVIDER} />

            <div>
              <h3 className={MONO_LABEL}>Invoice history</h3>
              {invoices.length === 0 ? (
                <p className="mt-3 text-[14.5px] text-[#44474d]">No invoices yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#0b1c30]/[0.06]">
                  {invoices.map((inv) => (
                    <li key={inv.date} className="flex items-center justify-between gap-4 py-3">
                      <span className="text-[14.5px]">{inv.date}</span>
                      <span className="flex items-center gap-4">
                        <span className="font-geist-mono text-[14px] tabular-nums">{inv.amount}</span>
                        <StatusChip tone="ok">{inv.status}</StatusChip>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Footnote>Billing is not wired to a payment provider yet. These figures are placeholders, not charges.</Footnote>
          </Bezel>
        )}

        {tab === 'team' && (
          <Bezel core={PANEL}>
            <PanelHead title="Team" />
            <TeamManager />
          </Bezel>
        )}

        {tab === 'notifications' && (
          <Bezel core={PANEL}>
            <PanelHead title="Notifications">
              <StatusChip title="Rules live in lib/alerts/rules.ts">Set in code</StatusChip>
            </PanelHead>
            <ul className="space-y-2">
              {[
                {
                  title: 'Rate recommendation moved',
                  trigger: `$${thresholds.rateDeltaUsd} or ${thresholds.rateDeltaPct}%`,
                  desc: "Emails when a night's recommendation moves this much from the last figure you were emailed. It compares against what you were last told, not the last run, so small moves can't add up to a stream of emails.",
                },
                {
                  title: 'Parity gap between channels',
                  trigger: `$${thresholds.parityGapUsd} or ${thresholds.parityGapPct}%`,
                  desc: 'Emails when your listed rate differs this much between your own site, Expedia and Booking.com.',
                },
                {
                  title: 'New meaningful event',
                  trigger: `Score ${thresholds.newEventMinScore}+`,
                  desc: `Emails the first time an event scores this high. Holidays are flagged ${thresholds.holidayLookaheadDays} days ahead.`,
                },
                {
                  title: 'A data source failing',
                  trigger: `${thresholds.sourceFailThreshold} runs in a row`,
                  desc: 'Emails after this many consecutive failed runs for one source, so a single flaky fetch stays quiet.',
                },
              ].map((rule) => (
                <li
                  key={rule.title}
                  className="grid gap-x-6 gap-y-2 rounded-[1rem] bg-[#0b1c30]/[0.035] px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium">{rule.title}</h3>
                    <p className="mt-1 max-w-[64ch] text-pretty text-[13.5px] leading-relaxed text-[#44474d]">{rule.desc}</p>
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <span className="font-geist-mono text-[14px] tabular-nums text-[#1a1b20]">{rule.trigger}</span>
                    <StatusChip tone="ok">Active</StatusChip>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-3 rounded-[1rem] bg-[#e5eeff] px-4 py-3.5">
              <InfoIcon weight="light" aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#085ac0]" />
              <p className="text-pretty text-[14px] leading-relaxed text-[#1a1b20]">
                These rules live in <Code>lib/alerts/rules.ts</Code> and repeat at most once every{' '}
                {thresholds.dedupeHours} hours. Recipients come from <Code>ALERT_EMAIL_TO</Code>. They are shown rather
                than toggled because a switch here would change nothing about what the alert engine sends.
              </p>
            </div>
          </Bezel>
        )}

        {tab === 'integrations' && (
          <>
            <Bezel core={PANEL}>
              <PanelHead title="Data sources">
                {isDemo ? (
                  <StatusChip title="Rendered from sample data, not a live feed">Sample data</StatusChip>
                ) : sources.length > 0 ? (
                  <StatusChip tone={healthy === sources.length ? 'ok' : 'warn'}>
                    {healthy} of {sources.length} healthy
                  </StatusChip>
                ) : null}
              </PanelHead>
              {sources.length === 0 ? (
                <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d]">
                  No collector run is recorded yet. Sources appear here after the first one.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {sources.map((s) => {
                    const ok = s.status === 'ok';
                    const awaiting = s.status === 'awaiting-key';
                    const meta = SOURCE_LABEL[s.source] ?? { name: s.source, feeds: '' };
                    return (
                      <li key={s.source} className="rounded-[1rem] bg-[#0b1c30]/[0.035] px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14.5px] font-medium leading-snug">{meta.name}</p>
                            {meta.feeds && <p className="text-[13px] text-[#44474d]">{meta.feeds}</p>}
                          </div>
                          <StatusChip tone={ok ? 'ok' : awaiting ? 'quiet' : 'bad'}>
                            {ok ? 'Connected' : awaiting ? 'No API key' : 'Failing'}
                          </StatusChip>
                        </div>
                        <p className={`${MONO_LABEL} mt-2 tabular-nums`}>
                          {awaiting ? 'Add its key to start collecting' : `Last run ${relative(s.fetchedAt)}`}
                        </p>
                        {!ok && s.error && (
                          <p className="mt-1 truncate text-[12.5px] text-[#44474d]" title={s.error}>
                            {s.error}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <Footnote>
                These are the integrations this system actually has. It reads demand and price signals; it never
                connects to a PMS or channel manager, because it never writes a price anywhere.
              </Footnote>
            </Bezel>

            {budget && (
              // Every figure here is the collector's own reading, so the core is navy.
              <Bezel tone="data" core={`${PANEL} text-white`}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h2 className="text-[22px] font-semibold tracking-tight">Price search budget</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      TIER_COPY[budget.tier].tone === 'ok' ? 'bg-[#84f9c3]/15 text-[#84f9c3]' : 'bg-[#f5b56b]/15 text-[#f5c98f]'
                    }`}
                  >
                    {TIER_COPY[budget.tier].label}
                  </span>
                </div>
                <p className="max-w-[64ch] text-pretty text-[14.5px] leading-relaxed text-white/75">
                  {TIER_COPY[budget.tier].detail}
                </p>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                  {[
                    { label: 'Searches left', value: String(budget.remaining) },
                    {
                      label: 'Used this cycle',
                      value: budget.perMonth ? `${budget.usedThisMonth} of ${budget.perMonth}` : String(budget.usedThisMonth),
                    },
                    { label: 'Spent last run', value: String(budget.spent) },
                    { label: 'Resets', value: budget.renewalDate ?? 'Unknown' },
                  ].map((stat) => (
                    <div key={stat.label} className="min-w-0">
                      <dt className="font-geist-mono text-[12px] text-[#adc6ff]">{stat.label}</dt>
                      <dd className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{stat.value}</dd>
                    </div>
                  ))}
                </dl>

                {(budget.skipped.length > 0 || budget.notFound.length > 0 || budget.unavailable.length > 0) && (
                  <div className="space-y-2 border-t border-white/[0.08] pt-5 text-[14px] leading-relaxed">
                    {budget.skipped.length > 0 && (
                      <p className="text-[#f5c98f]">
                        Skipped to save budget on the last run: {budget.skipped.map((s) => s.date).join(', ')}.
                      </p>
                    )}
                    {budget.notFound.length > 0 && (
                      <p className="text-white/70">
                        Not seen in Google Hotels results yet: {budget.notFound.join(', ')}. Either Google does not carry
                        them or they were sold out every time we looked. Once one appears with a price it is pinned by
                        token, and from then on the two are told apart.
                      </p>
                    )}
                    {budget.unavailable.length > 0 && (
                      <p className="text-white/70">
                        Carried by Google but not sellable that night, sold out or off the market:{' '}
                        {budget.unavailable.join(', ')}. These come back on their own; nothing to fix.
                      </p>
                    )}
                  </div>
                )}

                <p className="font-geist-mono text-[12px] leading-relaxed text-white/50">
                  Prices come from SerpApi&apos;s Google Hotels engine on a metered plan, so each run draws from a monthly
                  allowance. The collector reads the live balance before every run and narrows what it fetches rather
                  than failing when the budget runs low.
                </p>
              </Bezel>
            )}

            <Bezel core={PANEL}>
              <PanelHead title="Public API">
                <StatusChip>Version 1</StatusChip>
              </PanelHead>
              <p className="max-w-[64ch] text-pretty text-[14.5px] leading-relaxed text-[#44474d]">
                A key-authenticated REST API serving collected prices and recommendations, scoped per property. Every
                response carries its provenance (<Code>runAt</Code>, per-source status, confidence) so consumers can
                judge freshness for themselves.
              </p>
              <ul className="space-y-2">
                {[
                  ['/api/v1/properties', 'Hotels this key can read, and how fresh each is'],
                  ['/api/v1/properties/:id/rates', 'Your listed rate per source, and the parity gap'],
                  ['/api/v1/properties/:id/compset?date=', 'Competitor prices per night, and the median'],
                  ['/api/v1/properties/:id/recommendations?nights=', 'Nightly recommendations, reasoning and events'],
                ].map(([path, returns]) => (
                  <li
                    key={path}
                    className="grid gap-x-6 gap-y-1 rounded-[1rem] bg-[#0b1c30]/[0.035] px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
                  >
                    <span className="min-w-0 break-all font-geist-mono text-[13px]">
                      <span className="text-[#085ac0]">GET</span> {path}
                    </span>
                    <span className="text-[13.5px] text-[#44474d]">{returns}</span>
                  </li>
                ))}
              </ul>
              <Footnote>
                Authenticate with <Code>Authorization: Bearer rr_…</Code> or <Code>x-api-key</Code>, up to 60 requests a
                minute per key. Mint a key with <Code>npm run apikey -- --name &quot;label&quot;</Code>; it is stored
                hashed and shown once.
              </Footnote>
            </Bezel>

            <Bezel core={PANEL}>
              <PanelHead title="Ingest and schedule" />
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Fact label="Webhook endpoint" mono>
                  https://your-deployment.vercel.app/api/ingest
                </Fact>
                <Fact label="Secret" mono>
                  Bearer, from INGEST_SECRET
                </Fact>
              </dl>
              <div>
                <p className={MONO_LABEL}>Runs each day, {property.timezone.replace(/_/g, ' ')}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {['7:00', '10:00', '13:00', '15:00', '18:00', '20:00', '22:00'].map((t) => (
                    <li key={t} className="rounded-full bg-[#0b1c30]/[0.05] px-3 py-1 font-geist-mono text-[13px] tabular-nums">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <Footnote>
                GitHub&apos;s cron runs in UTC and ignores daylight saving, so the workflow checks the current Central
                hour before running. That keeps the schedule right in both CST and CDT.
              </Footnote>
            </Bezel>
          </>
        )}
      </div>
    </div>
  );
}

/** One read-only fact: a mono label over its value. */
function Fact({
  label,
  children,
  mono = false,
  big = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className={MONO_LABEL}>{label}</dt>
      <dd
        className={`mt-1 break-words ${
          big
            ? 'text-[26px] font-semibold leading-tight tracking-tight'
            : mono
              ? 'font-geist-mono text-[14px] tabular-nums'
              : 'text-[16px] font-medium'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}
