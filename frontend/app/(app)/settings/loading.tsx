import { Bezel } from '../../../components/landing/Machined';

/*
 * Shown while Settings loads. Same header, tab bar and first panel as the
 * page, so nothing jumps when it arrives; the blocks are the quiet navy tint
 * the system uses for "nothing here yet". The pulse stops under reduced motion.
 */

const BLOCK = 'rounded-[0.5rem] bg-[#0b1c30]/[0.06] motion-safe:animate-pulse';

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 font-geist" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-3">
        <div className={`${BLOCK} h-10 w-40`} />
        <div className={`${BLOCK} h-4 w-96 max-w-full`} />
      </div>
      <div className={`${BLOCK} h-11 w-[36rem] max-w-full rounded-full`} />
      <Bezel core="space-y-6 p-6 md:p-8">
        <div className={`${BLOCK} h-6 w-48`} />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className={`${BLOCK} h-3 w-24`} />
              <div className={`${BLOCK} h-5 w-48 max-w-full`} />
            </div>
          ))}
        </div>
      </Bezel>
      <Bezel core="space-y-4 p-6 md:p-8">
        <div className={`${BLOCK} h-6 w-64`} />
        <div className={`${BLOCK} h-16 rounded-[1rem]`} />
        <div className={`${BLOCK} h-16 rounded-[1rem]`} />
      </Bezel>
    </div>
  );
}
