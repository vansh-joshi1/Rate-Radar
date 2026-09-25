import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { todayIn } from '../../../../backend/lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../../backend/lib/bookings';
import Bellhop from '../../../components/Bellhop';

export const dynamic = 'force-dynamic';

export default async function BellhopPage() {
  const property = requestProperty();
  const bookings = (await requestStore().get<Bookings>(BOOKINGS_KEY)) ?? {};
  const tonight = bookings[todayIn(property.timezone)]?.at(-1) ?? null;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist text-[#1a1b20] antialiased`}>
      <Bellhop propertyName={property.name} totalRooms={property.totalRooms} tonight={tonight} />
    </div>
  );
}
