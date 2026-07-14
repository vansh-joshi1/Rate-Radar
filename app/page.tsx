import { getStore } from '../lib/store';
import { chicagoToday } from '../lib/ingest';
import type { HistoryRecord, Snapshot } from '../lib/scoring/types';
import TodayCard from '../components/TodayCard';
import Outlook from '../components/Outlook';
import ParityPanel from '../components/ParityPanel';
import CompsetPanel from '../components/CompsetPanel';
import HistoryLog from '../components/HistoryLog';
import NoteBox from '../components/NoteBox';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = getStore();
  const today = chicagoToday();
  const snapshot = await store.get<Snapshot>('snapshot:latest');
  const note = (await store.hget<string>('notes', today)) ?? '';
  const actuals = (await store.get<Record<string, Record<string, number>>>('actuals')) ?? {};
  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  const history: HistoryRecord[] = [];
  for (const d of historyDates.slice(0, 60)) {
    const rec = await store.hget<HistoryRecord>('history', d);
    if (rec) history.push(rec);
  }

  if (!snapshot) {
    return (
      <main>
        <h1>Rate Radar</h1>
        <section>
          <p>No data yet. Trigger the GitHub Actions workflow (Actions → collect → Run workflow) or run <code>npm run collect</code> locally, then refresh.</p>
        </section>
      </main>
    );
  }

  const ageHours = (Date.now() - new Date(snapshot.runAt).getTime()) / 3600_000;
  const failed = snapshot.sources.filter((s) => s.status !== 'ok');

  return (
    <main>
      <h1>Rate Radar <span className="muted small">Red Roof Inn Franklin, TN — recommends only, never changes prices</span></h1>
      {ageHours > 6 && (
        <div className="stale">Data is {Math.round(ageHours)}h old — the collector may not be running. Check GitHub Actions.</div>
      )}
      {failed.length > 0 && (
        <div className="stale">
          Source warning: {failed.map((s) => `${s.source} (${s.status}${s.error ? `: ${s.error.slice(0, 90)}` : ''})`).join(' · ')}
        </div>
      )}
      <TodayCard night={snapshot.nights[0]} confidence={snapshot.confidence} confidenceNote={snapshot.confidenceNote} />
      <NoteBox date={today} initial={note} />
      <ParityPanel parity={snapshot.parity} />
      <CompsetPanel compsets={snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : [])} />
      <Outlook nights={snapshot.nights} />
      <HistoryLog history={history} actuals={actuals} />
      <p className="muted small" style={{ marginTop: 20 }}>
        Last run {new Date(snapshot.runAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT · confidence {snapshot.confidence}%
      </p>
    </main>
  );
}
