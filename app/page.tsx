import Link from 'next/link';
import OriginIdInit from '../components/OriginIdInit';
import { RadarIcon } from '../components/RadarMark';
import RadarDemo from '../components/RadarDemo';
import HowItWorks from '../components/HowItWorks';

/*
 * Marketing landing — the "Instrument Panel" design language (DESIGN.md):
 * Cold Daylight canvas, Instrument Navy data surfaces, one Signal Cobalt accent,
 * Sora for display type.
 *
 * It hardcodes its palette as literal hex rather than reading the CSS variables,
 * because it is deliberately fixed-light: the app tokens flip under the `dark`
 * class and this page must not. The values are the same palette — if a token
 * changes, change it here too. Icons are inline SVG on purpose: the shared root
 * layout serves every logged-in page, so a global icon font for one page isn't
 * worth the bytes.
 */

// ---------------------------------------------------------------- icons

type IconProps = { className?: string };

function svgProps({ className }: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  } as const;
}

const HotelIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M3 21h18" /><path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" />
    <path d="M15 9h3a1 1 0 0 1 1 1v11" />
    <path d="M8 7h2M8 11h2M8 15h2" />
  </svg>
);

const EventIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="m12 12.5 1.1 2.2 2.4.35-1.75 1.7.4 2.4-2.15-1.13-2.15 1.13.4-2.4L8.5 15.05l2.4-.35Z" />
  </svg>
);

const WeatherIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M7 17.5a4 4 0 0 1 .5-7.97 5.5 5.5 0 0 1 10.4 1.55A3.5 3.5 0 0 1 17.5 17.5Z" />
    <path d="M9 21l-.7 1.2M13 20.5l-.7 1.2M17 21l-.7 1.2" />
  </svg>
);

const CurveIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M3 20V4M3 20h18" />
    <path d="M6.5 16c2.5 0 3-6 5.5-6s3.5 4 5.5 4 2.5-2 3-3" />
  </svg>
);

const CheckIcon = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="m4.5 12.5 5 5 10-11" /></svg>
);

const CheckCircleIcon = (p: IconProps) => (
  <svg {...svgProps(p)}><circle cx="12" cy="12" r="9.25" /><path d="m8 12.2 2.8 2.8L16 9.5" /></svg>
);

const ArrowIcon = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" /></svg>
);

const PlayIcon = (p: IconProps) => (
  <svg {...svgProps(p)}><circle cx="12" cy="12" r="9.25" /><path d="M10 8.5v7l5.5-3.5Z" /></svg>
);

// ---------------------------------------------------------------- content

const FEATURES = [
  {
    title: 'Hands-free parity monitoring',
    body:
      'Your listed rate on your own site, Expedia, Booking.com and Google Hotels, checked seven times a day. Gaps get flagged before they cost you direct bookings — no manual browsing, no spreadsheet.',
    tinted: false,
  },
  {
    title: 'Zero-effort event tracking',
    body:
      'Concerts, college football, conventions, holidays and weather alerts are pulled automatically and scored per night, weeks ahead — with travel draw and sellout likelihood already factored in.',
    tinted: false,
  },
  {
    title: 'Transparent reasoning engine',
    body:
      'Every recommendation ships with its math: baseline, event score, distance dampener, compset bound. Deterministic scoring, no black box — you see the data behind every dollar, then you set the price.',
    tinted: true,
  },
];

const FACTORS = [
  { Icon: HotelIcon, title: 'Nearby hotel pricing', body: 'Competitor rates and availability, bounding your quiet-night recommendations so you never drift off-market.' },
  { Icon: EventIcon, title: 'Upcoming local events', body: 'Concerts, games, conferences and festivals scored for overflow likelihood — not just listed on a calendar.' },
  { Icon: WeatherIcon, title: 'Weather & advisories', body: 'National Weather Service alerts and airport status, for the last-minute demand a calendar can’t see.' },
  { Icon: CurveIcon, title: 'Day-of-week curves', body: 'Your property’s own occupancy and booking pace, so the baseline reflects how your rooms actually sell.' },
];

const PLANS = [
  {
    name: 'Free', price: '$0', per: '', blurb: 'For tiny motels starting out.',
    items: ['1 property', '3-day forecast', 'Basic parity check'],
    cta: 'Choose Free', popular: false,
  },
  {
    name: 'Pro', price: '$29', per: '/mo', blurb: 'The full radar for independent owners.',
    items: ['1 property', '30-day forecast', 'Advanced event radar', 'Email alerts'],
    cta: 'Start 14-day trial', popular: true,
  },
  {
    name: 'Portfolio', price: '$79', per: '/mo', blurb: 'For managers with multiple properties.',
    items: ['Up to 10 properties', 'Portfolio dashboard', 'API access'],
    cta: 'Contact sales', popular: false,
  },
];

const ASSURANCES = [
  'Deterministic scoring you can audit, line by line',
  'Recommendation only — it never writes a price anywhere',
  '“Needs manual check” and “too small to matter” are shown, never hidden',
];

// ---------------------------------------------------------------- page

export default function Landing() {
  return (
    <div className="bg-[#f9f9ff] font-inter text-[#1a1b20] antialiased">
      {/* Visitor identification runs on the public landing page only. */}
      <OriginIdInit />

      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-[#c4c6cd]/40 bg-[#f9f9ff]/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <RadarIcon className="h-7 w-7 text-[#085ac0]" />
            <span className="font-display text-xl font-bold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#platform" className="text-[13px] font-semibold tracking-wide text-[#44474d] transition-colors hover:text-[#085ac0]">Product</Link>
            <Link href="#how-it-works" className="text-[13px] font-semibold tracking-wide text-[#44474d] transition-colors hover:text-[#085ac0]">How it works</Link>
            <Link href="#pricing" className="text-[13px] font-semibold tracking-wide text-[#44474d] transition-colors hover:text-[#085ac0]">Pricing</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13px] font-semibold text-[#44474d] transition-colors hover:text-[#085ac0]">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#085ac0] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
            >
              Get access
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative overflow-hidden px-6 pb-28 pt-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute right-0 top-0 h-[700px] w-3/4 rounded-bl-full bg-gradient-to-b from-[#e5eeff] to-transparent opacity-60 blur-3xl" />
            <div className="absolute bottom-0 left-10 h-[380px] w-1/2 rounded-full bg-[#d8e2ff]/40 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-[1200px] items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <h1 className="font-display text-[42px] font-bold leading-[1.08] tracking-tight text-[#0b1c30] md:text-[56px]">
                Stop guessing.
                <br />
                <span className="text-[#085ac0]">Know what tonight is worth.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#44474d]">
                Revenue management for independent hotels and motels. Rate Radar does the research — it watches
                competitor prices, local events, weather and holidays around the clock, then hands you a nightly
                rate with the reasoning attached.{' '}
                <span className="font-semibold text-[#0b1c30]">
                  It never changes a price anywhere — it recommends, a human decides.
                </span>
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#085ac0] px-7 py-3.5 text-[14px] font-semibold text-white transition-all hover:shadow-hover-lift hover:brightness-110"
                >
                  Get access
                  <ArrowIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c4c6cd] bg-white px-7 py-3.5 text-[14px] font-semibold text-[#0b1c30] transition-colors hover:bg-[#e5eeff]"
                >
                  <PlayIcon className="h-4 w-4" />
                  See the live demo
                </Link>
              </div>

              <p className="mt-6 text-[13px] text-[#74777d]">
                Runs on sample data until your property is connected — so you can see exactly how it reasons first.
              </p>
            </div>

            <RadarDemo />
          </div>
        </section>

        {/* platform */}
        <section id="platform" className="border-y border-[#c4c6cd]/25 bg-white px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="font-display text-[32px] font-bold tracking-tight text-[#0b1c30] md:text-[38px]">
                Rate recommendations that hold up under pressure
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#44474d]">
                Demand signals in, an explainable nightly rate out. Everything the system knows — and everything
                it doesn’t — is on the dashboard.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className={`group rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-0.5 ${
                    f.tinted
                      ? 'border-[#085ac0]/30 bg-[#e5eeff]/40 hover:border-[#085ac0] hover:shadow-hover-lift'
                      : 'border-[#c4c6cd] bg-white hover:border-[#085ac0]/50 hover:shadow-hover-lift'
                  }`}
                >
                  <div
                    className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                      f.tinted ? 'bg-[#085ac0] text-white' : 'bg-[#e8e7ee] text-[#0b1c30] group-hover:bg-[#085ac0]/10 group-hover:text-[#085ac0]'
                    }`}
                  >
                    <RadarIcon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-[20px] font-semibold text-[#0b1c30]">{f.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#44474d]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* rate factors */}
        <section id="factors" className="bg-[#f3f3fa] px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="font-display text-[32px] font-bold tracking-tight text-[#0b1c30] md:text-[38px]">
                What actually moves the number
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#44474d]">
                Four inputs, each one traceable back to a source you can check yourself.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {FACTORS.map(({ Icon, title, body }) => (
                <div
                  key={title}
                  className="flex flex-col items-center rounded-2xl border border-[#c4c6cd]/50 bg-white p-7 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-hover-lift"
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#085ac0]/10">
                    <Icon className="h-7 w-7 text-[#085ac0]" />
                  </div>
                  <h3 className="font-display text-[16px] font-semibold text-[#0b1c30]">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#44474d]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* how it works — scroll scrubs the pipeline; see HowItWorks.tsx */}
        <HowItWorks />

        {/* pricing */}
        <section id="pricing" className="border-t border-[#c4c6cd]/25 bg-[#f3f3fa] px-6 py-24">
          <div className="mx-auto max-w-[1000px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="font-display text-[32px] font-bold tracking-tight text-[#0b1c30] md:text-[38px]">
                Simple, fair pricing
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#44474d]">
                Built lean on purpose — priced for independent properties, not enterprise chains.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`relative flex flex-col rounded-2xl bg-white p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-hover-lift ${
                    p.popular ? 'border border-[#085ac0] bg-[#e5eeff]/40' : 'border border-[#c4c6cd]'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#085ac0] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                      Most popular
                    </div>
                  )}
                  <h3 className="font-display text-[20px] font-semibold text-[#0b1c30]">{p.name}</h3>
                  <div className="mt-3">
                    <span className="font-display text-[32px] font-bold tracking-tight text-[#0b1c30]">{p.price}</span>
                    {p.per && <span className="text-[14px] font-medium text-[#74777d]">{p.per}</span>}
                  </div>
                  <p className="mt-2 text-[13px] text-[#44474d]">{p.blurb}</p>

                  <ul className="mt-6 flex-grow space-y-3 border-t border-[#c4c6cd]/40 pt-6">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#1a1b20]">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#085ac0]" />
                        {i}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/signup"
                    className={`mt-8 block rounded-lg py-3 text-center text-[14px] font-semibold transition-all ${
                      p.popular
                        ? 'bg-[#085ac0] text-white hover:brightness-110'
                        : 'border border-[#c4c6cd] text-[#0b1c30] hover:bg-[#e5eeff]'
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* closing CTA */}
        <section className="relative overflow-hidden bg-[#0b1c30] px-6 py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-25">
            <div className="absolute left-1/4 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#085ac0] blur-[120px]" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-16 md:grid-cols-2">
            <div>
              <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight text-white md:text-[38px]">
                Ready to outpace your comp set?
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-[#75859d]">
                Set up in an afternoon. Free tier forever. Your prices stay yours — Rate Radar recommends, and
                nothing else.
              </p>
              <ul className="mt-8 space-y-4">
                {ASSURANCES.map((a) => (
                  <li key={a} className="flex items-start gap-3 text-[14px] text-white">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#67dca8]" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#c4c6cd]/30 bg-white p-8">
              <h3 className="font-display text-[20px] font-semibold text-[#0b1c30]">See it on real data</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#44474d]">
                Rate Radar accounts are invite-based — the property owner adds teammates from Settings → Team.
                Already invited? Sign in and you’re straight into the dashboard. Curious first? The live demo runs
                on sample data shaped exactly like the real thing.
              </p>

              <div className="mt-7 space-y-3">
                <Link
                  href="/signup"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#085ac0] px-4 py-3.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
                >
                  Get access
                  <ArrowIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c4c6cd] px-4 py-3.5 text-[14px] font-semibold text-[#0b1c30] transition-colors hover:bg-[#e5eeff]"
                >
                  <PlayIcon className="h-4 w-4" />
                  Open the live demo
                </Link>
              </div>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-[#74777d]">
                No card required. Rate Radar never pushes a price to your PMS, your website, or any OTA.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="border-t border-[#c4c6cd]/30 bg-[#f8f9ff] px-6 py-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 text-[13px] text-[#44474d] md:flex-row">
          <div className="flex items-center gap-2">
            <RadarIcon className="h-6 w-6 text-[#085ac0]" />
            <span className="font-display text-[16px] font-bold text-[#0b1c30]">Rate Radar</span>
          </div>
          <div className="flex gap-8">
            <Link href="#platform" className="transition-colors hover:text-[#085ac0]">Product</Link>
            <Link href="#pricing" className="transition-colors hover:text-[#085ac0]">Pricing</Link>
            <Link href="/login" className="transition-colors hover:text-[#085ac0]">Sign in</Link>
          </div>
          <p className="text-[#74777d]">© 2026 Rate Radar. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
