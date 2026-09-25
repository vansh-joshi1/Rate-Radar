import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { RadarIcon } from '../components/RadarMark';
import { Bezel, Eyebrow, PillCta } from '../components/landing/Machined';

/*
 * The 404, on the marketing surface's machined parts (DESIGN.md → Marketing
 * surface). It says plainly what happened and offers the two places a visitor
 * most likely meant to go. Fixed-light hex for the same reason as app/page.tsx.
 */
export default function NotFound() {
  return (
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} flex min-h-[100dvh] flex-col bg-[#f8f9ff] px-4 font-geist text-[#1a1b20] antialiased md:px-6`}
    >
      <div className="mx-auto flex w-full max-w-[1200px] pt-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full bg-white/70 py-2 pl-4 pr-5 ring-1 ring-[#0b1c30]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40"
        >
          <RadarIcon className="h-5 w-5 text-[#085ac0]" />
          <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 items-center py-24">
        <Bezel className="w-full max-w-2xl" core="p-8 md:p-12">
          <Eyebrow>404</Eyebrow>
          <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[56px]">
            Nothing at this address.
          </h1>
          <p className="mt-5 max-w-[46ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
            The link may be old, or the page may have moved. Start again from the front page, or try the demo.
          </p>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <PillCta href="/">Back to the start</PillCta>
            <PillCta href="/demo" variant="secondary">
              Open the demo
            </PillCta>
          </div>
        </Bezel>
      </div>
    </main>
  );
}
