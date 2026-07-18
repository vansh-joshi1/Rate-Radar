'use client';
import { useState } from 'react';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';
import { demoInvoices } from '../../../lib/demo';

const TABS = ['Property', 'Team', 'Billing', 'API & Data'] as const;
type Tab = (typeof TABS)[number];

function H4({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-4 border-b border-line pb-1 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </h4>
  );
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>('Billing');

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Settings</SectionTitle>
        <SampleBadge />
      </div>

      <div className="mb-6 flex gap-8 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 text-sm font-semibold ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Property' && (
        <div className="max-w-2xl">
          <H4>Property details</H4>
          <div className="card mb-6 grid gap-4 sm:grid-cols-2">
            <div><label className="label">Property name</label><input className="field" defaultValue="Red Roof Inn Franklin" /></div>
            <div><label className="label">Brand</label><input className="field" defaultValue="Red Roof" /></div>
            <div className="sm:col-span-2"><label className="label">Address</label><input className="field" defaultValue="3915 Carothers Pkwy, Franklin, TN" /></div>
          </div>
          <H4>Room tiers &amp; baseline rates</H4>
          <div className="card p-0">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="th">Tier</th><th className="th">Weekday</th><th className="th">Weekend</th></tr></thead>
              <tbody>
                <tr><td className="td font-semibold">Standard</td><td className="td font-serif">$79</td><td className="td font-serif">$94</td></tr>
                <tr><td className="td font-semibold">Superior</td><td className="td font-serif">$94</td><td className="td font-serif">$109</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Baselines live in config/rates.json today; this form persists once per-property config moves to the database.</p>
        </div>
      )}

      {tab === 'Team' && (
        <div className="max-w-2xl">
          <H4>Members</H4>
          <div className="card mb-4 p-0">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="th">Member</th><th className="th">Role</th><th className="th" /></tr></thead>
              <tbody>
                {[
                  { name: 'Vansh Joshi', email: 'vansh@hotel.com', role: 'Owner' },
                  { name: 'Front Desk', email: 'desk@hotel.com', role: 'Revenue Manager' },
                  { name: 'Family', email: 'family@hotel.com', role: 'Viewer' },
                ].map((m) => (
                  <tr key={m.email} className="hover:bg-ink/[0.03]">
                    <td className="td">
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted">{m.email}</div>
                    </td>
                    <td className="td"><Chip tone={m.role === 'Owner' ? 'bad' : 'neutral'}>{m.role}</Chip></td>
                    <td className="td text-right"><button className="btn btn-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <input className="field max-w-xs" placeholder="teammate@hotel.com" />
            <button className="btn btn-primary">Invite</button>
          </div>
        </div>
      )}

      {tab === 'Billing' && (
        <div className="max-w-2xl">
          <H4>Current plan</H4>
          <div className="card mb-8 flex items-center justify-between">
            <div>
              <div className="font-serif text-2xl font-bold">Pro Plan</div>
              <div className="text-sm text-muted">$29 / month · billed monthly · Stripe test mode</div>
            </div>
            <button className="btn">Change plan</button>
          </div>

          <H4>Payment method</H4>
          <div className="card mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-6 w-10 items-center justify-center rounded bg-ink/10 text-[9px] font-bold">VISA</div>
              <div>
                <div className="font-semibold">Visa ending in 4242</div>
                <div className="text-xs text-muted">Expires 12/2028 · Stripe&apos;s universal test card</div>
              </div>
            </div>
            <button className="btn btn-sm">Update</button>
          </div>

          <H4>Invoice history</H4>
          <div className="card p-0">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="th">Date</th><th className="th">Amount</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody>
                {demoInvoices.map((inv) => (
                  <tr key={inv.date} className="hover:bg-ink/[0.03]">
                    <td className="td">{inv.date}</td>
                    <td className="td tabular-nums">{inv.amount}</td>
                    <td className="td"><Chip tone="ok">{inv.status}</Chip></td>
                    <td className="td text-right"><a href="#" className="font-semibold text-accent">PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'API & Data' && (
        <div className="max-w-2xl">
          <H4>Public API (v1)</H4>
          <div className="card mb-8">
            <p className="mb-4 text-sm">
              Key-authenticated REST API serving collected prices and recommendations, scoped per property.
              Every response carries provenance — <code className="text-xs">runAt</code>, per-source status,
              confidence — so consumers can judge freshness themselves.
            </p>
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className="th">Endpoint</th><th className="th">Returns</th></tr></thead>
              <tbody>
                <tr><td className="td font-mono text-xs">GET /api/v1/properties</td><td className="td">Hotels this key can read + freshness</td></tr>
                <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/rates</td><td className="td">Own listed rate per source + parity gap</td></tr>
                <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/compset?date=</td><td className="td">Competitor prices per night, median</td></tr>
                <tr><td className="td font-mono text-xs">GET /api/v1/properties/:id/recommendations?nights=</td><td className="td">Nightly recs, reasoning, events</td></tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted">
              Auth: <code>Authorization: Bearer rr_…</code> or <code>x-api-key</code> header · 60 req/min per key ·
              mint keys with <code>npm run apikey -- --name &quot;label&quot;</code> (hash-stored, shown once).
            </p>
          </div>

          <H4>Ingest webhook</H4>
          <div className="card mb-8">
            <label className="label">Endpoint</label>
            <input className="field mb-3 font-mono text-xs" readOnly value="https://your-deployment.vercel.app/api/ingest" />
            <label className="label">Secret</label>
            <input className="field font-mono text-xs" readOnly value="Bearer ••••••••••••••••  (INGEST_SECRET)" />
            <p className="mt-3 text-xs text-muted">The collector POSTs its bundle here. Runs from GitHub Actions, 7×/day Central time.</p>
          </div>
          <H4>Collector schedule</H4>
          <div className="card">
            <p className="text-sm">7:00 · 10:00 · 13:00 · 15:00 · 18:00 · 20:00 · 22:00 <span className="text-muted">(America/Chicago)</span></p>
            <p className="mt-2 text-xs text-muted">GitHub cron is UTC and ignores DST — the workflow gates on the current Central hour, so it&apos;s correct in both CST and CDT.</p>
          </div>
        </div>
      )}
    </div>
  );
}
