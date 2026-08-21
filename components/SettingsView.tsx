'use client';
import { useState } from 'react';
import BaselineEditor from './BaselineEditor';
import TeamManager from './TeamManager';
import CurrentRatesCard from './CurrentRates';
import { Chip, SampleBadge } from './ui';
import CollectionHealth from './CollectionHealth';
import type { RunTelemetry } from '../collector/telemetry';

/*
 * Settings, built to the supplied design: a vertical pill-tab rail beside
 * stacked section cards.
 *
 * Two panels depart from the mock's content, for the same reason as elsewhere:
 *
 *   - Integrations. The mock lists "Opera Cloud PMS" and "SiteMinder" as
 *     connected. This product has no PMS integration at all and its core
 *     promise is that it never writes a price anywhere, so those cards would
 *     be a flat fabrication on the one page people trust for configuration.
 *     The panel shows the integrations that genuinely exist — the collector's
 *     data sources — with their real health from the last run.
 *
 *   - Notifications. The mock has toggles. Alert rules live in
 *     lib/alerts/rules.ts and there is no store or endpoint behind them, so a
 *     toggle would flip, appear saved, and change nothing about what lands in
 *     an inbox. The panel states the thresholds that actually fire instead.
 */

const Icon = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`} aria-hidden>
    {name}
  </span>
);

const TABS = [
  { id: 'property', label: 'Property & Rates', icon: 'domain' },
  { id: 'billing', label: 'Billing', icon: 'payments' },
  { id: 'team', label: 'Team', icon: 'group' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'integrations', label: 'Integrations', icon: 'extension' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CARD = 'rounded-xl border border-line bg-card p-md md:p-xl';
const FIELD_RO =
  'w-full rounded-lg border border-line bg-paper px-4 py-2.5 font-body-md text-body-md text-ink';
const LABEL = 'mb-1 block font-label-md text-label-md uppercase text-muted';

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-lg flex flex-wrap items-center justify-between gap-sm border-b border-line pb-4">
      <h3 className="font-headline-lg text-headline-lg text-ink">{title}</h3>
      {action}
    </div>
  );
}

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

interface Props {
  property: { id: string; name: string; city: string; timezone: string; lat: number; lng: number };
  tiers: { tierId: string; label: string }[];
  sources: SourceHealth[];
  thresholds: Thresholds;
  telemetryRuns: RunTelemetry[];
  invoices: { date: string; amount: string; status: string }[];
  isDemo: boolean;
}

const relative = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

/** Human names for the collector's sources. */
const SOURCE_LABEL: Record<string, string> = {
  ticketmaster: 'Ticketmaster — concerts & shows',
  cfbd: 'College Football Data — Vanderbilt games',
  nws: 'National Weather Service — alerts',
  faa: 'FAA — BNA airport status',
  calendars: 'University & convention calendars',
  rates: 'Rate checks — your site, Expedia, Booking, Google',
};

export default function SettingsView({ property, tiers, sources, thresholds, invoices, isDemo, telemetryRuns }: Props) {
  const [tab, setTab] = useState<TabId>('property');

  const tabBtn = (active: boolean) =>
    `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 font-body-md text-body-md transition-all duration-200 ${
      active
        ? 'bg-accent font-semibold text-white'
        : 'font-medium text-muted hover:bg-paper hover:text-ink'
    }`;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-xl">
        <h2 className="mb-2 font-headline-xl text-headline-xl text-ink">Settings</h2>
        <p className="font-body-lg text-body-lg text-muted">
          Manage your property profile, preferences, and system integrations.
        </p>
      </div>

      {/* Tab rail runs across the top. Sticky under the 80px app header so it
          stays reachable while a long panel scrolls; scrolls horizontally on
          narrow screens rather than wrapping into a ragged second row. */}
      <nav
        className="sticky top-20 z-30 -mx-1 mb-lg flex gap-1 overflow-x-auto rounded-xl border border-line bg-card p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={tabBtn(tab === t.id)}
          >
            <Icon name={t.icon} className="text-[20px]" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-lg">
          {tab === 'property' && (
            <>
              <section className={CARD}>
                <SectionHead
                  title="Property Profile"
                  action={
                    <span className="rounded bg-ink/5 px-2 py-1 font-label-md text-[10px] uppercase text-muted">
                      Read-only
                    </span>
                  }
                />
                <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={LABEL}>Property name</label>
                    <input className={FIELD_RO} readOnly value={property.name} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={LABEL}>Location</label>
                    <input className={FIELD_RO} readOnly value={property.city} />
                  </div>
                  <div>
                    <label className={LABEL}>Timezone</label>
                    <input className={FIELD_RO} readOnly value={property.timezone} />
                  </div>
                  <div>
                    <label className={LABEL}>Coordinates</label>
                    <input
                      className={`${FIELD_RO} font-data-mono tabular-nums`}
                      readOnly
                      value={`${property.lat.toFixed(4)}, ${property.lng.toFixed(4)}`}
                    />
                  </div>
                </div>
                <p className="mt-md text-xs text-muted">
                  The property registry is code-configured (<code>lib/properties.ts</code>) because every stored
                  record is keyed by property id — renaming one here would orphan its history. Rates below are
                  fully editable.
                </p>
              </section>

              <section className={CARD}>
                <SectionHead title="Room Tiers & Baseline Rates" />
                <BaselineEditor propertyId={property.id} />
              </section>

              <section className={CARD}>
                <SectionHead title="Your Current Rates" />
                <CurrentRatesCard propertyId={property.id} tiers={tiers} />
              </section>
            </>
          )}

          {tab === 'billing' && (
            <section className={CARD}>
              <SectionHead
                title="Billing & Subscription"
                action={
                  <div className="flex items-center gap-sm">
                    <SampleBadge />
                    <span className="rounded bg-[#029768] px-2 py-1 font-label-md text-[10px] font-bold uppercase text-white">
                      Active Plan
                    </span>
                  </div>
                }
              />
              <div className="mb-lg grid grid-cols-1 gap-md md:grid-cols-3">
                <div className="rounded-lg border border-line bg-paper p-4">
                  <p className="mb-1 font-label-md text-label-md uppercase text-muted">Current Plan</p>
                  <p className="font-headline-md text-headline-md text-ink">Pro</p>
                  <p className="mt-2 font-body-md text-body-md text-muted">$29 / month</p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-4">
                  <p className="mb-1 font-label-md text-label-md uppercase text-muted">Next Invoice</p>
                  <p className="font-headline-md text-headline-md text-ink">—</p>
                  <p className="mt-2 font-body-md text-body-md text-muted">Not yet billed</p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-4">
                  <p className="mb-1 font-label-md text-label-md uppercase text-muted">Payment Method</p>
                  <div className="flex items-center gap-2">
                    <Icon name="credit_card" className="text-muted" />
                    <p className="font-body-md text-body-md text-ink">•••• 4242</p>
                  </div>
                  <p className="mt-2 text-xs text-muted">Stripe test card</p>
                </div>
              </div>

              <h4 className="mb-sm font-label-md text-label-md uppercase text-muted">Invoice history</h4>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Amount</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.date} className="hover:bg-ink/[0.03]">
                        <td className="td">{inv.date}</td>
                        <td className="td tabular-nums">{inv.amount}</td>
                        <td className="td"><Chip tone="ok">{inv.status}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-md text-xs text-muted">
                Billing isn&apos;t wired to a payment provider yet — these figures are placeholders, not charges.
              </p>
            </section>
          )}

          {tab === 'team' && (
            <section className={CARD}>
              <SectionHead title="Team Management" />
              <TeamManager />
            </section>
          )}

          {tab === 'notifications' && (
            <section className={CARD}>
              <SectionHead
                title="Notification Preferences"
                action={
                  <span className="rounded bg-ink/5 px-2 py-1 font-label-md text-[10px] uppercase text-muted">
                    Configured in code
                  </span>
                }
              />
              <div className="divide-y divide-line">
                {[
                  {
                    title: 'Rate recommendation moved',
                    desc: `Emails when a night's recommendation shifts by $${thresholds.rateDeltaUsd} or ${thresholds.rateDeltaPct}% versus the last emailed figure — compared against what you were last told, not the last run, so it can't drip.`,
                  },
                  {
                    title: 'Parity gap between sources',
                    desc: `Emails when your listed rate differs by $${thresholds.parityGapUsd} or ${thresholds.parityGapPct}% across your own site, Expedia and Booking.com.`,
                  },
                  {
                    title: 'New meaningful event detected',
                    desc: `Emails the first time an event scores ${thresholds.newEventMinScore} or above. Holidays are flagged ${thresholds.holidayLookaheadDays} days ahead.`,
                  },
                  {
                    title: 'Collector source failing',
                    desc: `Emails after ${thresholds.sourceFailThreshold} consecutive failed runs for a source, so one flaky fetch stays quiet.`,
                  },
                ].map((rule) => (
                  <div key={rule.title} className="flex items-start justify-between gap-md py-4">
                    <div className="min-w-0">
                      <h4 className="font-medium text-ink">{rule.title}</h4>
                      <p className="mt-0.5 text-sm text-muted">{rule.desc}</p>
                    </div>
                    <Chip tone="ok">Active</Chip>
                  </div>
                ))}
              </div>
              <div className="mt-lg flex items-start gap-3 rounded-lg border border-accent/20 bg-accent-muted p-4">
                <Icon name="info" className="shrink-0 text-accent" />
                <p className="font-body-md text-body-md text-ink">
                  These rules live in <code>lib/alerts/rules.ts</code> and repeat at most once every{' '}
                  {thresholds.dedupeHours} hours. Recipients come from <code>ALERT_EMAIL_TO</code>. They&apos;re
                  shown rather than toggled because nothing here would change what the alert engine sends.
                </p>
              </div>
            </section>
          )}

          {tab === 'integrations' && (
            <>
              <section className={CARD}>
                <SectionHead
                  title="Data Sources"
                  action={
                    <span className="font-label-md text-label-md uppercase text-muted">
                      {isDemo ? 'sample data' : `${sources.filter((s) => s.status === 'ok').length}/${sources.length} healthy`}
                    </span>
                  }
                />
                {sources.length === 0 ? (
                  <p className="font-body-md text-body-md text-muted">
                    No collector run recorded yet — sources appear after the first ingest.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {sources.map((s) => {
                      const ok = s.status === 'ok';
                      const bar = ok ? 'bg-[#029768]' : s.status === 'awaiting-key' ? 'bg-muted' : 'bg-bad';
                      return (
                        <div
                          key={s.source}
                          className="relative overflow-hidden rounded-lg border border-line bg-paper p-4"
                        >
                          <div className={`absolute right-0 top-0 h-full w-2 ${bar}`} />
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-ink">{SOURCE_LABEL[s.source] ?? s.source}</h4>
                            {ok && <Icon name="check_circle" className="text-[16px] text-[#029768]" />}
                          </div>
                          <p
                            className={`mt-1 font-label-md text-[11px] uppercase ${
                              ok ? 'text-[#029768]' : s.status === 'awaiting-key' ? 'text-muted' : 'text-bad'
                            }`}
                          >
                            {ok
                              ? `Connected • ${relative(s.fetchedAt)}`
                              : s.status === 'awaiting-key'
                                ? 'API key not configured'
                                : `Failed • ${relative(s.fetchedAt)}`}
                          </p>
                          {!ok && s.error && (
                            <p className="mt-1 truncate text-xs text-muted" title={s.error}>
                              {s.error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-md text-xs text-muted">
                  These are the integrations this system actually has. It reads demand and price signals — it
                  never connects to a PMS or channel manager, because it never writes a price anywhere.
                </p>
              </section>

              <CollectionHealth runs={telemetryRuns} />

              <section className={CARD}>
                <SectionHead title="Public API (v1)" />
                <p className="mb-md font-body-md text-body-md text-ink">
                  Key-authenticated REST API serving collected prices and recommendations, scoped per property.
                  Every response carries provenance — <code className="text-xs">runAt</code>, per-source status,
                  confidence — so consumers can judge freshness themselves.
                </p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr><th className="th">Endpoint</th><th className="th">Returns</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="td font-mono text-xs">GET /api/v1/properties</td><td className="td">Hotels this key can read + freshness</td></tr>
                      <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/rates</td><td className="td">Own listed rate per source + parity gap</td></tr>
                      <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/compset?date=</td><td className="td">Competitor prices per night, median</td></tr>
                      <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/recommendations?nights=</td><td className="td">Nightly recs, reasoning, events</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-md text-xs text-muted">
                  Auth: <code>Authorization: Bearer rr_…</code> or <code>x-api-key</code> · 60 req/min per key ·
                  mint with <code>npm run apikey -- --name &quot;label&quot;</code> (hash-stored, shown once).
                </p>
              </section>

              <section className={CARD}>
                <SectionHead title="Ingest & Schedule" />
                <label className={LABEL}>Webhook endpoint</label>
                <input className={`${FIELD_RO} mb-md font-mono text-xs`} readOnly value="https://your-deployment.vercel.app/api/ingest" />
                <label className={LABEL}>Secret</label>
                <input className={`${FIELD_RO} font-mono text-xs`} readOnly value="Bearer ••••••••••••••••  (INGEST_SECRET)" />
                <p className="mt-md font-body-md text-body-md text-ink">
                  7:00 · 10:00 · 13:00 · 15:00 · 18:00 · 20:00 · 22:00{' '}
                  <span className="text-muted">({property.timezone})</span>
                </p>
                <p className="mt-2 text-xs text-muted">
                  GitHub cron is UTC and ignores DST — the workflow gates on the current Central hour, so it&apos;s
                  correct in both CST and CDT.
                </p>
              </section>
            </>
          )}
      </div>
    </div>
  );
}
