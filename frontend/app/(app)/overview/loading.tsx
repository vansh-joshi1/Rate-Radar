import { Bezel } from '../../../components/landing/Machined';

/*
 * Shown while the dashboard's snapshot loads. Same enclosures and grid as the
 * page, so nothing jumps when the readings arrive; the blocks are the quiet
 * navy tint the system uses for "nothing here yet". The pulse stops under
 * reduced motion.
 */

const BLOCK = 'rounded-[0.5rem] bg-[#0b1c30]/[0.06] motion-safe:animate-pulse';

export default function OverviewLoading() {
  return (
    <div className="space-y-8 font-geist" aria-busy="true" aria-label="Loading the dashboard">
      <div className="space-y-3">
        <div className={`${BLOCK} h-10 w-72 max-w-full`} />
        <div className={`${BLOCK} h-4 w-96 max-w-full`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Bezel className="lg:col-span-7" core="space-y-6 p-6 md:p-8">
          <div className={`${BLOCK} h-3 w-40`} />
          <div className={`${BLOCK} h-16 w-44`} />
          <div className="grid grid-cols-2 gap-6">
            <div className={`${BLOCK} h-10`} />
            <div className={`${BLOCK} h-10`} />
          </div>
          <div className={`${BLOCK} h-32 rounded-[1.25rem]`} />
        </Bezel>

        <Bezel tone="data" className="lg:col-span-5" core="space-y-4 p-6 md:p-8">
          <div className="h-3 w-40 rounded-[0.5rem] bg-white/[0.08] motion-safe:animate-pulse" />
          <div className="h-14 w-32 rounded-[0.5rem] bg-white/[0.08] motion-safe:animate-pulse" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-5 rounded-[0.5rem] bg-white/[0.06] motion-safe:animate-pulse" />
          ))}
        </Bezel>

        <Bezel className="lg:col-span-12" core="grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className={`${BLOCK} h-6 w-48`} />
            <div className={`${BLOCK} h-12`} />
            <div className={`${BLOCK} h-12`} />
          </div>
          <div className="grid grid-cols-6 gap-2 self-start">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${BLOCK} aspect-square`} />
            ))}
          </div>
        </Bezel>
      </div>
    </div>
  );
}
