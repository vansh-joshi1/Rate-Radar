import { requestProperty, requestStore } from '../../../lib/demo/context';
import { todayIn } from '../../../lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../lib/bookings';
import type { HistoryRecord } from '../../../lib/scoring/types';
import HistoryTable from '../../../components/HistoryTable';
import Bellhop from '../../../components/Bellhop';
import { SectionTitle } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function BellhopPage() {
  const store = requestStore();
  const property = requestProperty();
  const actuals = (await store.get<Record<string, Record<string, number>>>('actuals')) ?? {};
  const bookings = (await store.get<Bookings>(BOOKINGS_KEY)) ?? {};
  const tonight = bookings[todayIn(property.timezone)]?.at(-1) ?? null;
  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  const history: HistoryRecord[] = [];
  for (const d of historyDates.slice(0, 60)) {
    const rec = await store.hget<HistoryRecord>('history', d);
    if (rec) history.push(rec);
  }

  return (
    <div>
      <SectionTitle>Bellhop</SectionTitle>
      <div className="mb-8">
        <Bellhop totalRooms={property.totalRooms} tonight={tonight} />
      </div>

      <h3 className="mb-1 text-lg font-bold tracking-tight">History — recommended vs. actually charged</h3>
      <p className="mb-3 text-sm text-muted">
        Enter what you actually charged so you can judge over time whether this thing is useful.
      </p>
      <HistoryTable history={history} actuals={actuals} />
    </div>
  );
}
