import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { requestProperty, requestStore } from '../../../lib/demo/context';
import { todayIn } from '../../../lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../lib/bookings';
import type { HistoryRecord } from '../../../lib/scoring/types';
import HistoryTable from '../../../components/HistoryTable';
import Bellhop from '../../../components/Bellhop';

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
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist text-[#1a1b20] antialiased`}>
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight">Bellhop</h1>
        <p className="max-w-[60ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
          Questions about {property.name}&apos;s rates, answered from Rate Radar&apos;s own numbers.
        </p>
      </header>

      <Bellhop totalRooms={property.totalRooms} tonight={tonight} />

      <section className="mt-12">
        <h2 className="text-[22px] font-semibold tracking-tight">Recommended vs. actually charged</h2>
        <p className="mb-4 mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-[#44474d]">
          Enter what you actually charged so you can judge over time whether this thing is useful.
        </p>
        <HistoryTable history={history} actuals={actuals} />
      </section>
    </div>
  );
}
