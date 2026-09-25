import { Bezel } from '../../../components/landing/Machined';

/*
 * Shown while Market Intelligence loads. Same enclosures and grid as the page,
 * so nothing jumps when the readings arrive; the blocks are the quiet navy
 * tint the system uses for "nothing here yet". The pulse stops under reduced
 * motion.
 */

const BLOCK = 'rounded-[0.5rem] bg-[#0b1c30]/[0.06] motion-safe:animate-pulse';
const DARK = 'rounded-[0.5rem] bg-white/[0.06] motion-safe:animate-pulse';

export default function MarketIntelligenceLoading() {
  return (
    <div className="space-y-8 font-geist" aria-busy="true" aria-label="Loading market intelligence">
      <div className="space-y-3">
        <div className={`${BLOCK} h-10 w-64 max-w-full`} />
        <div className={`${BLOCK} h-4 w-96 max-w-full`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Bezel tone="data" className="xl:col-span-7" core="space-y-6 p-6 md:p-8">
          <div className={`${DARK} h-6 w-40`} />
          <div className="h-[360px] rounded-[1.25rem] bg-white/[0.04] motion-safe:animate-pulse md:h-[460px]" />
          <div className={`${DARK} h-4 w-72 max-w-full`} />
        </Bezel>

        <Bezel className="xl:col-span-5" core="space-y-4 p-6 md:p-8">
          <div className={`${BLOCK} h-6 w-48`} />
          <div className={`${BLOCK} h-8 w-64 max-w-full rounded-full`} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`${BLOCK} h-14`} />
          ))}
        </Bezel>

        <Bezel className="xl:col-span-12" core="space-y-4 p-6 md:p-8">
          <div className={`${BLOCK} h-6 w-44`} />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className={`${BLOCK} h-[88px]`} />
            ))}
          </div>
        </Bezel>
      </div>
    </div>
  );
}
