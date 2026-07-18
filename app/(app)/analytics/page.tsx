import { getStore } from '../../../lib/store';
import { demoEventPerformance } from '../../../lib/demo';
import type { HistoryRecord } from '../../../lib/scoring/types';
import HistoryTable from '../../../components/HistoryTable';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';

export const dynamic = 'force-dynamic';

const STATS = [
  { label: 'Acceptance rate', value: '71%', note: 'You followed 22 of 31 recs', tone: '' },
  { label: 'Estimated impact', value: '+$1,420', note: 'Uplift from applied recs', tone: 'text-ok' },
  { label: 'Avg. parity gap', value: '$4.20', note: 'OTAs vs direct', tone: '' },
];

export default async function Analytics() {
  const store = getStore();
  const actuals = (await store.get<Record<string, Record<string, number>>>('actuals')) ?? {};
  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  const history: HistoryRecord[] = [];
  for (const d of historyDates.slice(0, 60)) {
    const rec = await store.hget<HistoryRecord>('history', d);
    if (rec) history.push(rec);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Revenue performance</SectionTitle>
        <SampleBadge />
      </div>

      <div className="mb-8 grid gap-5 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="card text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">{s.label}</div>
            <div className={`my-1.5 font-serif text-4xl font-semibold ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-muted">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="card mb-8">
        <h3 className="mb-4 font-serif text-xl font-bold">Recommended vs. actually charged</h3>
        <div className="relative flex h-72 items-center justify-center border border-dashed border-line bg-ink/[0.02]">
          <svg width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="none" className="max-w-2xl">
            <path d="M0,150 Q50,140 100,160 T200,130 T300,140 T400,100" fill="none" stroke="var(--accent-red)" strokeWidth="2" />
            <path d="M0,160 Q50,155 100,170 T200,150 T300,155 T400,130" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4" />
          </svg>
          <div className="absolute bottom-2 text-xs text-muted">Solid = recommended · Dashed = actually charged</div>
        </div>
      </div>

      <h3 className="mb-3 font-serif text-xl font-bold">Event-night performance <SampleBadge /></h3>
      <div className="card mb-8 p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Event</th><th className="th">Date</th><th className="th">Rec applied?</th>
                <th className="th">ADR achieved</th><th className="th">Uplift</th>
              </tr>
            </thead>
            <tbody>
              {demoEventPerformance.map((e) => (
                <tr key={e.event} className="hover:bg-ink/[0.03]">
                  <td className="td">{e.event}</td>
                  <td className="td">{e.date}</td>
                  <td className="td">{e.applied ? <Chip tone="ok">Yes</Chip> : <Chip>No</Chip>}</td>
                  <td className="td font-serif text-lg">${e.adr}</td>
                  <td className={`td font-semibold ${e.applied ? 'text-ok' : ''}`}>{e.uplift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="mb-1 font-serif text-xl font-bold">History — recommended vs. actually charged</h3>
      <p className="mb-3 text-sm text-muted">
        Enter what you actually charged so you can judge over time whether this thing is useful.
      </p>
      <HistoryTable history={history} actuals={actuals} />
    </div>
  );
}
