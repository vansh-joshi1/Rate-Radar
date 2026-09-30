import { demoSid, requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { todayIn } from '../../../../backend/lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../../backend/lib/bookings';
import { limitsForProperty } from '../../../../backend/lib/billing/limits';
import Bellhop from '../../../components/Bellhop';
import { BellhopUpgrade } from '../../../components/Billing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bellhop' };

export default async function BellhopPage() {
  const property = await requestProperty();
  if (!(await limitsForProperty(property.id)).bellhop) return <BellhopUpgrade />;
  const bookings = (await (await requestStore()).get<Bookings>(BOOKINGS_KEY)) ?? {};
  const tonight = bookings[todayIn(property.timezone)]?.at(-1) ?? null;

  return (
    <div className="font-sans text-[#1a1b20] antialiased">
      <Bellhop
        totalRooms={property.totalRooms}
        tonight={tonight}
        web={!(await demoSid())}
      />
    </div>
  );
}
