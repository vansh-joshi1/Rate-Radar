import { NextResponse } from 'next/server';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { todayIn } from '../../../../backend/lib/date';
import type { HistoryRecord, Snapshot } from '../../../../backend/lib/scoring/types';

export async function GET() {
  const store = await requestStore();
  const today = todayIn((await requestProperty()).timezone);
  const [snapshot, note, actuals] = await Promise.all([
    store.get<Snapshot>('snapshot:latest'),
    store.hget<string>('notes', today),
    store.get<Record<string, Record<string, number>>>('actuals'),
  ]);
  // History: hash keyed by date — read via a stored index of dates
  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  const history: HistoryRecord[] = [];
  for (const d of historyDates.slice(0, 60)) {
    const rec = await store.hget<HistoryRecord>('history', d);
    if (rec) history.push(rec);
  }
  return NextResponse.json({ snapshot, note: note ?? '', actuals: actuals ?? {}, history });
}
