import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import OriginIdInit from '../components/OriginIdInit';
import { RadarIcon } from '../components/RadarMark';
import RadarDemo from '../components/RadarDemo';
import HowItWorks from '../components/HowItWorks';
import Reveal from '../components/Reveal';
import IslandNav from '../components/landing/IslandNav';
import { Bezel, Eyebrow, PillCta } from '../components/landing/Machined';
import { DOT_FIELD, Grain, HeroRadar } from '../components/landing/Backdrop';
import HonestStates from '../components/landing/HonestStates';

/*
 * Marketing landing in the "Machined Instrument" language (DESIGN.md →
 * Marketing surface): a cold daylight canvas, Geist throughout, and every
 * major panel set in a double-bezel enclosure with one soft navy-tinted
 * ambient shadow instead of a grey hairline. The palette rules still hold:
 * Instrument Navy only where a panel holds machine readings, Signal Cobalt
 * only where the system concluded something or where you are.
 *
 * The visuals are the product's own components in miniature: the draggable
 * compset in the hero, then a reasoning card, a parity readout and a demand
 * calendar. Every figure comes from the invented demo world (lib/demo.ts).
 * The page does not label it as sample data, by the owner's decision
 * (PRODUCT.md, Evidence on Hand).
 *
 * Fixed-light, literal hex: the app tokens flip under the `dark` class and
 * this page must not. Plans and prices are the owner's own (decided
 * 2026-09-22, PRODUCT.md); do not add tiers, limits or features to them here.
 */

const mono = 'font-geist-mono text-[12px]';
const chip = 'inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium';
const divide = 'divide-y divide-[#0b1c30]/[0.06]';
const textLink =
  'rounded-full transition-colors duration-300 hover:text-[#0b1c30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-[#f8f9ff]';

// ---------------------------------------------------------------- readings

const REASONS: { text: string; delta: string; rejected?: boolean }[] = [
  { text: 'Saturday baseline', delta: '$84' },
  { text: 'Cascadia State vs. Ridgeline, score 46, meaningful', delta: '+9%' },
  { text: 'Compset median $99. Event nights are never capped', delta: 'no cap' },
  { text: 'Harbor Run 5K, score 8', delta: 'Too small to matter', rejected: true },
];

/** The signature component, in miniature (DESIGN.md → Reasoning Card). */
function ReasoningPreview() {
  return (
    <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={`${mono} text-[#44474d]`}>Saturday, Standard</div>
            <div className="mt-2 text-[48px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0]">$92</div>
          </div>
          <div className="text-right font-geist-mono text-[13px] tabular-nums text-[#44474d]">
            <div>$88 to $96</div>
            <div className="text-[#029768]">+10% vs baseline</div>
          </div>
        </div>
        <ul className={`mt-6 ${divide}`}>
          {REASONS.map((r) => (
            <li key={r.text} className="flex items-baseline justify-between gap-4 py-3 text-[14px] leading-snug">
              <span className={`flex min-w-0 gap-3 ${r.rejected ? 'text-[#44474d]' : 'text-[#1a1b20]'}`}>
                <span aria-hidden className={r.rejected ? 'text-[#0b1c30]/25' : 'text-[#085ac0]'}>•</span>
                {r.text}
              </span>
              {r.rejected ? (
                <span className={`${chip} bg-[#0b1c30]/[0.05] text-[#44474d]`}>
                  {r.delta}
                </span>
              ) : (
                <span className="shrink-0 font-geist-mono text-[13px] tabular-nums">{r.delta}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="md:border-l md:border-[#0b1c30]/[0.08] md:pl-8">
        <div className={`${mono} text-[#44474d]`}>Confidence</div>
        <div className="mt-2 text-[28px] font-semibold tracking-tight tabular-nums text-[#1a1b20]">68%</div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0b1c30]/[0.08]">
          <span
            className="block h-full origin-left rounded-full bg-[#029768] transition-transform delay-500 duration-[1100ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[shown=false]/reveal:scale-x-0 motion-reduce:transition-none"
            style={{ width: '68%' }}
          />
        </div>
        <p className="mt-3 text-pretty text-[12.5px] leading-relaxed text-[#44474d]">
          5 of 6 sources fresh. Hotel prices are on a 4h old cache.
        </p>
        <p className="mt-6 text-pretty text-[12.5px] leading-relaxed text-[#44474d]">
          Rate Radar never changes a price anywhere.
        </p>
      </div>
    </div>
  );
}

const CHANNELS: { name: string; price?: number; own?: boolean }[] = [
  { name: 'Direct, your site', price: 89, own: true },
  { name: 'Booking.com', price: 99 },
  { name: 'Expedia.com', price: 101 },
  { name: 'Hotels.com', price: 101 },
  { name: 'Agoda' },
];

function ParityPreview() {
  const direct = 89;
  return (
    <ul className="divide-y divide-white/[0.08]">
      {CHANNELS.map((c) => (
        <li key={c.name} className="flex items-center justify-between gap-4 py-3">
          <span className={`min-w-0 truncate text-[14px] ${c.own ? 'font-medium text-white' : 'text-[#d8e2ff]'}`}>
            {c.name}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {c.price !== undefined && (
              <span className="font-geist-mono text-[13px] tabular-nums text-white">${c.price}</span>
            )}
            {c.own ? (
              <span className={`${chip} bg-[#adc6ff] text-[#0b1c30]`}>You</span>
            ) : c.price === undefined ? (
              <span className={`${chip} text-[#fbbf24] ring-1 ring-inset ring-[#fbbf24]/40`}>Needs manual check</span>
            ) : (
              <span className={`${chip} bg-[#fbbf24]/10 text-[#fbbf24]`}>+${c.price - direct}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Tier = 'quiet' | 'minor' | 'meaningful' | 'major';
const TIER_WEEKS: Tier[][] = [
  ['quiet', 'quiet', 'quiet', 'minor', 'major', 'meaningful', 'quiet'],
  ['quiet', 'minor', 'quiet', 'quiet', 'meaningful', 'meaningful', 'minor'],
  ['quiet', 'quiet', 'minor', 'quiet', 'minor', 'major', 'quiet'],
];
const TIER_STYLE: Record<Tier, string> = {
  quiet: 'bg-[#0b1c30]/[0.04] text-[#44474d]',
  minor: 'bg-[#d3e4fe] text-[#0b1c30]',
  meaningful: 'bg-[#085ac0] text-white',
  major: 'bg-[#131b2e] text-white',
};
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function DemandPreview() {
  const days = TIER_WEEKS.flat();
  return (
    <div>
      {/* Three weeks of seven on a phone, one 21-night strip from lg up, the
          way the dashboard's calendar reads. */}
      <ol
        className="grid grid-cols-7 gap-1.5 lg:grid-cols-[repeat(21,minmax(0,1fr))]"
        aria-label="21 nights of demand"
      >
        {days.map((tier, i) => {
          const date = i < 20 ? 12 + i : 1;
          return (
            <li
              key={i}
              className="flex flex-col items-center gap-1.5 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[shown=false]/reveal:translate-y-2 group-data-[shown=false]/reveal:opacity-0 motion-reduce:transition-none"
              style={{ transitionDelay: `${250 + i * 30}ms` }}
            >
              <span aria-hidden className="font-geist-mono text-[10px] uppercase text-[#44474d]">
                {WEEKDAYS[i % 7]}
              </span>
              <span
                aria-label={`${date}, ${tier}`}
                className={`flex aspect-square w-full items-center justify-center rounded-lg font-geist-mono text-[12px] tabular-nums ${TIER_STYLE[tier]}`}
              >
                {date}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#44474d]">
        {(Object.keys(TIER_STYLE) as Tier[]).map((t) => (
          <li key={t} className="flex items-center gap-2 capitalize">
            <span aria-hidden className={`h-3 w-3 rounded ${TIER_STYLE[t]}`} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- pricing

/* Prices, property counts, the trial and the price-watch horizon are the
   owner's (PRODUCT.md, commercial model). The shared list below is what the
   product already does for every property today, not a packaging split. */
const PLANS: {
  name: string;
  audience: string;
  price?: string;
  facts: string[];
  cta: { href: string; label: string };
  primary?: boolean;
}[] = [
  {
    name: 'One property',
    audience: 'For a single independent hotel or motel.',
    price: '$99',
    facts: ['1 property', '14-day free trial'],
    cta: { href: '/signup', label: 'Start free trial' },
    primary: true,
  },
  {
    name: 'Three properties',
    audience: 'For owners running a small group.',
    price: '$349',
    facts: ['Up to 3 properties', '30-day price watch', 'Everything in One property'],
    cta: { href: '/signup', label: 'Get access' },
  },
  {
    name: 'Enterprise',
    audience: 'For management companies and big groups.',
    facts: ['More than 3 properties', 'Setup and terms agreed with you'],
    cta: { href: '/signup', label: 'Contact us' },
  },
];

const INCLUDED = [
  'A nightly rate for each room tier, with a range and a confidence',
  'The reasoning behind every number, rejected signals included',
  'Rate parity across the channels Google Hotels lists for you',
  'Competitor prices from a compset you choose',
  'A 21-night demand calendar scored from local events',
  'Email alerts only when something actually changes',
  'Team access with owner, manager and viewer roles',
  'Setup done with you by a person, not a form',
];

// ---------------------------------------------------------------- page

export default function Landing() {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} bg-[#f8f9ff] font-geist text-[#1a1b20] antialiased`}
      style={DOT_FIELD}
    >
      <Grain />
      {/* Visitor identification runs on the public landing page only. */}
      <OriginIdInit />

      {/* Skip link: first stop for keyboard users, invisible until focused.
          z-50 sits over the island nav (z-40), its phone menu (z-30) and the
          page grain (z-20). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#085ac0] focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <IslandNav />

      <main id="main" tabIndex={-1} className="outline-none">
        {/* hero: the claim on the left, the mechanic itself on the right */}
        <section className="relative isolate px-4 pb-24 pt-32 md:px-6 md:pb-40 md:pt-44">
          <HeroRadar />
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <div className="animate-fade-in-up">
                <Eyebrow>For independent hotels and motels</Eyebrow>
              </div>
              <h1 className="animate-fade-in-up delay-100 mt-6 text-balance text-[44px] font-semibold leading-[1.02] tracking-tighter text-[#0b1c30] md:text-[68px]">
                Know what to charge tonight.
              </h1>
              <p className="animate-fade-in-up delay-200 mt-7 max-w-[44ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
                Rate Radar reads competitor prices, local events and weather, then recommends a nightly rate with
                the arithmetic attached.
              </p>
              <div className="animate-fade-in-up delay-300 mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <PillCta href="/demo">Open the demo</PillCta>
                <PillCta href="/signup" variant="secondary">
                  Get access
                </PillCta>
              </div>
            </div>

            <div className="animate-fade-in-up delay-400 min-w-0">
              <Bezel core="overflow-hidden">
                <RadarDemo />
              </Bezel>
            </div>
          </div>
        </section>

        {/* readings: three product surfaces, in miniature, as an asymmetric bento */}
        <section id="readings" className="scroll-mt-24 px-4 pb-24 md:px-6 md:pb-40">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <h2 className="max-w-[18ch] text-balance text-[36px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[52px]">
                Every rate comes with its math.
              </h2>
              <p className="mt-6 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
                The same three readings sit on the dashboard each morning.
              </p>
            </Reveal>

            <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <Bezel className="h-full" core="h-full p-7 md:p-9">
                  <h3 className="text-balance text-[22px] font-semibold tracking-tight text-[#0b1c30]">
                    The reasoning, line by line
                  </h3>
                  <p className="mt-2 max-w-[52ch] text-pretty text-[14.5px] leading-relaxed text-[#44474d]">
                    Every signal the scorer weighed, including the one it threw out.
                  </p>
                  <div className="mt-9">
                    <ReasoningPreview />
                  </div>
                </Bezel>
              </Reveal>

              <Reveal delay={120} className="lg:col-span-5">
                <Bezel className="h-full" core="h-full p-7 md:p-9" tone="data">
                  <h3 className="text-balance text-[22px] font-semibold tracking-tight text-white">Rate parity</h3>
                  <p className="mt-2 text-pretty text-[14.5px] leading-relaxed text-[#adc6ff]">
                    Your own rate across the channels Google Hotels lists for you.
                  </p>
                  <div className="mt-7">
                    <ParityPreview />
                  </div>
                </Bezel>
              </Reveal>

              <Reveal delay={200} className="lg:col-span-12">
                <Bezel core="p-7 md:p-9">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-balance text-[22px] font-semibold tracking-tight text-[#0b1c30]">
                        Three weeks of demand
                      </h3>
                      <p className="mt-2 text-pretty text-[14.5px] leading-relaxed text-[#44474d]">
                        Each night tiered by the events scored against it.
                      </p>
                    </div>
                  </div>
                  <div className="mt-8">
                    <DemandPreview />
                  </div>
                </Bezel>
              </Reveal>
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* the load-bearing product fact, stated once and at full size */}
        <section className="px-4 py-24 md:px-6 md:py-40">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <h2 className="text-balance text-[48px] font-semibold leading-[1] tracking-tighter text-[#0b1c30] md:text-[88px]">
                It recommends.{' '}
                {/* The handoff, in two beats: the second sentence resolves after the
                    first, from faint to full, as the section arrives. */}
                <span className="transition-colors delay-500 duration-[1100ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[shown=false]/reveal:text-[#0b1c30]/15 motion-reduce:transition-none">
                  You decide.
                </span>
              </h2>
              <p className="mt-8 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
                Rate Radar never writes a price to your PMS, your website or any booking channel. When it isn&rsquo;t
                sure, it says so in plain words.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <HonestStates />
            </Reveal>
          </div>
        </section>

        {/* pricing: three plans, set by the owner */}
        <section id="pricing" className="scroll-mt-24 px-4 pb-24 md:px-6 md:pb-40">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[52px]">
                Priced per property
              </h2>
              <p className="mt-6 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
                Start with one hotel on a 14-day free trial. Add properties when you need them.
              </p>
            </Reveal>

            <ul className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
              {PLANS.map((plan, i) => (
                <Reveal as="li" key={plan.name} delay={i * 100}>
                  <Bezel
                    className={`h-full ${plan.price ? '' : '!bg-transparent !shadow-none'}`}
                    core={`flex h-full flex-col p-8 ${plan.price ? '' : '!bg-[#0b1c30]/[0.035] !shadow-none'}`}
                  >
                    <h3 className="text-[18px] font-semibold tracking-tight text-[#0b1c30]">{plan.name}</h3>
                    <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-[#44474d]">{plan.audience}</p>
                    <div className="mt-6 flex items-baseline gap-2">
                      {plan.price ? (
                        <>
                          <span className="text-[48px] font-semibold leading-none tracking-tighter tabular-nums text-[#0b1c30]">
                            {plan.price}
                          </span>
                          <span className="text-[14px] text-[#44474d]">a month</span>
                        </>
                      ) : (
                        <span className="text-[32px] font-semibold leading-[1.5] tracking-tighter text-[#0b1c30]">
                          Custom
                        </span>
                      )}
                    </div>
                    <ul className={`mt-8 flex-1 ${divide}`}>
                      {plan.facts.map((f) => (
                        <li key={f} className="flex gap-3 py-3 text-[14.5px] text-[#1a1b20]">
                          <span aria-hidden className="text-[#085ac0]">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      <PillCta href={plan.cta.href} variant={plan.primary ? 'primary' : 'secondary'}>
                        {plan.cta.label}
                      </PillCta>
                    </div>
                  </Bezel>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={150} className="mt-16 border-t border-[#0b1c30]/[0.08] pt-10">
              <div>
                <h3 className="text-[18px] font-semibold tracking-tight text-[#0b1c30]">Included in every plan</h3>
                <ul className="mt-6 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex gap-3 text-pretty text-[14px] leading-relaxed text-[#1a1b20]">
                      <span aria-hidden className="text-[#085ac0]">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <p className="mt-10 text-[13px] text-[#44474d]">Prices in US dollars.</p>
          </div>
        </section>

        {/* closing: the demo, for anyone not ready to talk pricing */}
        <section id="demo" className="relative isolate scroll-mt-24 px-4 pb-24 md:px-6 md:pb-40">
          <HeroRadar variant="echo" />
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <div className="grid grid-cols-1 items-end gap-10 border-t border-[#0b1c30]/[0.08] pt-16 md:grid-cols-[minmax(0,1fr)_auto] md:pt-24">
                <div>
                  <h2 className="text-balance text-[32px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[44px]">
                    Try it on a sample hotel first.
                  </h2>
                  <p className="mt-5 max-w-[48ch] text-pretty text-[17px] leading-relaxed text-[#44474d]">
                    The demo opens a private sandbox of Harbor Pine Inn. No sign&#8209;up, every control is live, and your
                    edits clear after a day.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <PillCta href="/demo">Open the demo</PillCta>
                  <Link
                    href="/login"
                    className={`text-[14px] font-medium text-[#44474d] underline decoration-[#0b1c30]/20 underline-offset-4 ${textLink}`}
                  >
                    Already invited? Sign in
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-10 md:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 border-t border-[#0b1c30]/[0.08] pt-8 text-[13px] text-[#44474d] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <RadarIcon className="h-5 w-5 text-[#085ac0]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2">
            <a href="#how-it-works" className={textLink}>
              How it works
            </a>
            <Link href="/demo" className={textLink}>
              Open the demo
            </Link>
            <Link href="/login" className={textLink}>
              Sign in
            </Link>
          </nav>
          <p>&copy; 2026 Rate Radar</p>
        </div>
      </footer>
    </div>
  );
}
