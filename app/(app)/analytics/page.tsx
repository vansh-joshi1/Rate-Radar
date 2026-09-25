import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { requestProperty, requestStore } from '../../../lib/demo/context';
import { todayIn } from '../../../lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../lib/bookings';
import Bellhop, { BellhopAvatar } from '../../../components/Bellhop';

export const dynamic = 'force-dynamic';

export default async function BellhopPage() {
  const property = requestProperty();
  const bookings = (await requestStore().get<Bookings>(BOOKINGS_KEY)) ?? {};
  const tonight = bookings[todayIn(property.timezone)]?.at(-1) ?? null;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist text-[#1a1b20] antialiased`}>
      <header className="mb-6 flex items-center gap-4">
        <BellhopAvatar size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Bellhop</h1>
          <p className="max-w-[60ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
            Questions about {property.name}&apos;s rates, answered from Rate Radar&apos;s own numbers.
          </p>
        </div>
      </header>

      <Bellhop totalRooms={property.totalRooms} tonight={tonight} />
    </div>
  );
}
