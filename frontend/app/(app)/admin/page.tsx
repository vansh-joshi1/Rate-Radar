import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../../backend/auth';
import { demoPortfolio } from '../../../../backend/lib/demo';
import { demoSid } from '../../../../backend/lib/demo/context';
import { getStore } from '../../../../backend/lib/store';
import { listProperties } from '../../../../backend/lib/properties';
import { listAccessRequests } from '../../../../backend/lib/access-requests';
import { listMembers, memberProperty } from '../../../../backend/lib/auth/members';
import { loadPropertySnapshot } from '../../../../backend/lib/api/context';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';
import ApproveRequest from '../../../components/ApproveRequest';

export const dynamic = 'force-dynamic';

/**
 * Portfolio: every hotel on Rate Radar, and the access requests waiting to
 * become one. OWNER_EMAIL only — it is the one page that reads across hotels.
 * A demo visitor sees the invented portfolio instead.
 */
export default async function Admin() {
  if (demoSid()) return <SamplePortfolio />;
  const session = await auth();
  if (!session?.user.isAdmin) redirect('/overview');

  const store = getStore();
  const [properties, requests, members] = await Promise.all([
    listProperties(store),
    listAccessRequests(store),
    listMembers(store),
  ]);
  const snapshots = await Promise.all(properties.map((p) => loadPropertySnapshot(p.id)));
  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-3">
          <SectionTitle>Access requests</SectionTitle>
          {pending.length > 0 && <Chip tone="warn">{pending.length} waiting</Chip>}
        </div>
        {pending.length === 0 ? (
          <p className="card text-sm text-muted">No requests waiting. New ones from /onboarding appear here.</p>
        ) : (
          <div className="card p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="th">Hotel</th>
                    <th className="th">Requested by</th>
                    <th className="th">Rooms</th>
                    <th className="th">Competitors</th>
                    <th className="th">Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.email} className="align-top">
                      <td className="td">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs text-muted">{r.address}</div>
                        <div className="text-xs text-muted">{r.type}{r.token ? ' · matched on Google Hotels' : ' · no Google Hotels match'}</div>
                      </td>
                      <td className="td">
                        <div>{r.email}</div>
                        <div className="text-xs text-muted">{r.phone}</div>
                        <div className="text-xs text-muted">{new Date(r.submittedAt).toLocaleDateString()}</div>
                      </td>
                      <td className="td">{r.rooms}</td>
                      <td className="td text-xs text-muted">{r.competitors.join(', ')}</td>
                      <td className="td min-w-[16rem]">
                        <ApproveRequest email={r.email} name={r.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <SectionTitle>All properties</SectionTitle>
        </div>
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="th">Property</th>
                  <th className="th">Last collection</th>
                  <th className="th">Confidence</th>
                  <th className="th">Team</th>
                  <th className="th">Airport</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p, i) => {
                  const snap = snapshots[i];
                  const team = members.filter((m) => memberProperty(m) === p.id).length;
                  return (
                    <tr key={p.id}>
                      <td className="td">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">{p.city}</div>
                      </td>
                      <td className="td">
                        {snap ? age(snap.runAt) : <Chip className="opacity-60">Waiting for first run</Chip>}
                      </td>
                      <td className="td">{snap ? `${snap.confidence}%` : '—'}</td>
                      <td className="td">{team}</td>
                      <td className="td">{p.collect ? p.collect.airport ?? 'none' : 'BNA'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Each hotel sees only its own dashboard. New hotels are collected on the next scheduled run; every hotel shares
          one SerpApi quota, split evenly per run.
        </p>
      </section>
    </div>
  );
}

function age(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 60 ? `${mins}m ago` : mins < 2880 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`;
}

function SamplePortfolio() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionTitle>All properties</SectionTitle>
          <SampleBadge />
        </div>
        <button className="btn btn-primary btn-sm">+ Add property</button>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Property</th>
                <th className="th">Tonight&apos;s rec</th>
                <th className="th">Occupancy</th>
                <th className="th">Parity</th>
                <th className="th">Alerts</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {demoPortfolio.map((p) => (
                <tr key={p.name} className="hover:bg-ink/[0.03]">
                  <td className="td">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">{p.city}</div>
                  </td>
                  <td className="td text-xl font-semibold text-accent">${p.rec}</td>
                  <td className="td">{p.occupancy}</td>
                  <td className="td">
                    {p.parity === 'gap' ? <Chip tone="bad">Gap detected</Chip> : <Chip tone="ok">In parity</Chip>}
                  </td>
                  <td className="td">
                    {p.alerts > 0 ? <Chip tone="warn">{p.alerts} new</Chip> : <Chip className="opacity-50">0</Chip>}
                  </td>
                  <td className="td text-right">
                    <Link href="/overview" className="btn btn-sm">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Portfolio view — one row per property. One property is live today; the rest illustrate the
        multi-property model.
      </p>
    </div>
  );
}
