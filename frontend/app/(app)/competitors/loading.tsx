import { Bezel } from '../../../components/landing/Machined';

/*
 * Shown while the competitors page loads. Same enclosures and grid as the
 * page, so nothing jumps when the readings arrive; the blocks are the quiet
 * navy tint the system uses for "nothing here yet". The pulse stops under
 * reduced motion.
 */

const BLOCK = 'rounded-[0.5rem] bg-[#0b1c30]/[0.06] motion-safe:animate-pulse';

export default function CompetitorsLoading() {
  return (
    <div className="space-y-8 font-geist" aria-busy="true" aria-label="Loading competitor prices">
      <div className="space-y-3">
        <div className={`${BLOCK} h-10 w-56 max-w-full`} />
        <div className={`${BLOCK} h-4 w-96 max-w-full`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Bezel className="lg:col-span-7" core="space-y-6 p-6 md:p-8">
          <div className={`${BLOCK} h-3 w-40`} />
          <div className={`${BLOCK} h-16 w-40`} />
          <div className={`${BLOCK} h-24 rounded-[1.25rem]`} />
          <div className="grid grid-cols-3 gap-6">
            <div className={`${BLOCK} h-10`} />
            <div className={`${BLOCK} h-10`} />
            <div className={`${BLOCK} h-10`} />
          </div>
        </Bezel>

        <Bezel tone="data" className="lg:col-span-5" core="space-y-4 p-6 md:p-8">
          <div className="h-3 w-40 rounded-[0.5rem] bg-white/[0.08] motion-safe:animate-pulse" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-5 rounded-[0.5rem] bg-white/[0.06] motion-safe:animate-pulse" />
          ))}
        </Bezel>

        <Bezel className="lg:col-span-7" core="space-y-4 p-6 md:p-8">
          <div className={`${BLOCK} h-6 w-40`} />
          <div className={`${BLOCK} h-60 rounded-[1.25rem]`} />
        </Bezel>

        <Bezel className="lg:col-span-5" core="space-y-4 p-6 md:p-8">
          <div className={`${BLOCK} h-6 w-48`} />
          <div className={`${BLOCK} h-10 w-24`} />
          <div className={`${BLOCK} h-5`} />
          <div className={`${BLOCK} h-5`} />
        </Bezel>

        <Bezel className="lg:col-span-12" core="space-y-4 p-6 md:p-8">
          <div className={`${BLOCK} h-6 w-32`} />
          <div className={`${BLOCK} h-12 rounded-full`} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`${BLOCK} h-8`} />
          ))}
        </Bezel>
      </div>
    </div>
  );
}
