import Link from 'next/link';
import OriginIdInit from '../components/OriginIdInit';

/*
 * Marketing landing — modern SaaS look (announcement bar, sticky nav, gradient
 * hero + dark data panel, eyebrow-labeled sections, rounded cards). Deliberately
 * fixed-light and Inter-set; the app behind login keeps the motel-ledger theme.
 */

const RED = '#c8102e';
const RED_DEEP = '#8f0b21';

const PLATFORM_CARDS = [
  {
    title: 'Transparent reasoning',
    body: 'Every recommendation ships with its math: baseline, event score, distance dampener, compset bound. No black box — you see the data behind every dollar.',
  },
  {
    title: 'Event radar',
    body: 'Concerts, college football, conventions, holidays — demand signals scored per night, weeks ahead, with sellout likelihood and travel draw factored in.',
  },
  {
    title: 'Parity monitoring',
    body: 'Your listed rate on your own site, Expedia, Booking.com, and Google Hotels, checked 7× a day. Gaps get flagged before they cost you direct bookings.',
  },
  {
    title: 'Compset guardrail',
    body: 'Nearby competitor prices bound your quiet-night rates so you never drift off-market. Event nights are never capped — that’s when you earn.',
  },
  {
    title: 'Email alerts that matter',
    body: 'One email when something actually merits attention — a rate move, a parity gap, a big event added. No daily noise, no dashboard babysitting.',
  },
  {
    title: 'Honest states',
    body: '“Needs manual check” and “too small to matter” are first-class verdicts, shown to you — never silently hidden. You always know what the system knows.',
  },
];

const STEPS = [
  { n: '1', title: 'Collect', body: 'Ticketmaster, college football, weather, holiday calendars, and your OTA listings — gathered automatically, 7 times a day.' },
  { n: '2', title: 'Score', body: 'Every event gets a deterministic overflow-likelihood score. Uplift compounds per night with diminishing returns — no ML mystery.' },
  { n: '3', title: 'You decide', body: 'A recommendation with reasoning lands on your dashboard (and inbox when it matters). You set the price. We never touch it.' },
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{children}</div>;
}

export default function Landing() {
  return (
    <div className="font-inter bg-white text-slate-900">
      {/* Visitor identification runs on the public landing page only. */}
      <OriginIdInit />
      {/* announcement bar */}
      <div className="bg-slate-900 px-4 py-2.5 text-center text-[13px] text-slate-200">
        Every night gets a verdict — even &quot;this event is too small to matter.&quot;{' '}
        <Link href="#platform" className="font-semibold text-white underline underline-offset-2">Why that matters</Link>
      </div>

      {/* sticky nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: RED }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: RED }} />
            </span>
            <div className="text-xl font-bold tracking-tight">Rate Radar</div>
          </div>
          <div className="hidden items-center gap-8 text-[15px] font-medium text-slate-700 md:flex">
            <Link href="#platform" className="hover:text-slate-900">Product</Link>
            <Link href="#how" className="hover:text-slate-900">How it works</Link>
            <Link href="#pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/login" className="hover:text-slate-900">Demo</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[15px] font-medium text-slate-700 hover:text-slate-900">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-white transition-colors"
              style={{ background: RED }}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <header
        className="px-5 py-20 text-white md:py-28"
        style={{
          background: `radial-gradient(900px 480px at 28% 18%, #ef3a55 0%, transparent 62%), linear-gradient(160deg, ${RED} 0%, ${RED_DEEP} 78%)`,
        }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              For independent hotels &amp; motels
            </div>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Know what to charge tonight.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Demand-driven rate recommendations for independent hotels. Events, holidays, weather, and competitor
              prices in; a nightly rate with transparent reasoning out.{' '}
              <span className="font-semibold text-white">It never changes a price anywhere — it recommends, a human decides.</span>
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-slate-900 shadow-sm transition-transform hover:scale-[1.02]"
              >
                Try live demo
              </Link>
              <Link
                href="#how"
                className="rounded-full border border-white/50 px-7 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10"
              >
                See how it works
              </Link>
            </div>
          </div>

          {/* dark panel — a miniature of the actual dashboard */}
          <div className="rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10 md:p-7">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold text-slate-300">Red Roof Inn · Franklin, TN</div>
              <div className="text-xs text-slate-400">updated 2m ago</div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4 rounded-xl bg-white/5 p-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tonight · Standard</div>
                <div className="mt-1 font-serif text-6xl font-semibold leading-none text-white">$89</div>
              </div>
              <div className="pb-1 text-right">
                <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-400">+12% uplift</span>
                <div className="mt-2 text-xs text-slate-400">Superior $104 · range $84–94</div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-300">Morgan Wallen @ Nissan Stadium</span>
                <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400">score 82 · major</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Vanderbilt home game</span>
                <span className="shrink-0 text-xs text-slate-500">too small to matter — shown anyway</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-300">Expedia listing $101</span>
                <span className="shrink-0 rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-400">$12 gap</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                <span>Confidence</span><span>78%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: '78%' }} />
              </div>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-400">
              Deterministic scoring · checked 7×/day · never writes prices
            </div>
          </div>
        </div>
      </header>

      {/* platform */}
      <section id="platform" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>Platform</Eyebrow>
          <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
            Rate recommendations that hold up under pressure
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Demand signals in, an explainable nightly rate out. Everything the system knows — and doesn&apos;t know — is
            on the dashboard.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_CARDS.map((c) => (
              <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md">
                <h3 className="text-lg font-bold">{c.title}</h3>
                <p className="mt-2.5 leading-relaxed text-slate-600">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="bg-[#f5f4f0] px-5 py-24">
        <div className="mx-auto max-w-6xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
            How a night gets its rate
          </h2>
          <div className="mt-14 grid gap-6 text-left md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ background: RED }}
                >
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="px-5 py-24">
        <div className="mx-auto max-w-6xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Simple, fair pricing.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Built lean on purpose — priced for independent properties, not enterprise chains.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border bg-white p-8 text-left shadow-sm ${
                  p.popular ? 'border-[#c8102e] ring-1 ring-[#c8102e]' : 'border-slate-200'
                }`}
              >
                {p.popular && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide text-white"
                    style={{ background: RED }}
                  >
                    Popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-3 text-4xl font-extrabold tracking-tight">
                  {p.price}
                  {p.per && <span className="text-lg font-medium text-slate-500">{p.per}</span>}
                </div>
                <p className="mt-2 text-sm text-slate-600">{p.blurb}</p>
                <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-6 text-[15px]">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="font-bold text-emerald-600">✓</span>
                      {i}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 block rounded-full py-3 text-center text-[15px] font-semibold transition-colors ${
                    p.popular ? 'text-white' : 'border border-slate-300 text-slate-900 hover:bg-slate-50'
                  }`}
                  style={p.popular ? { background: RED } : undefined}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* bottom CTA */}
      <section
        className="px-5 py-20 text-center text-white"
        style={{ background: `linear-gradient(160deg, ${RED} 0%, ${RED_DEEP} 85%)` }}
      >
        <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight">
          Stop guessing what tonight is worth.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
          Set up in an afternoon. Free tier forever. Your prices stay yours.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-slate-900 shadow-sm transition-transform hover:scale-[1.02]"
        >
          Get started free
        </Link>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-200 px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-slate-500 md:flex-row">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: RED }} />
            Rate Radar
          </div>
          <div className="flex gap-8">
            <Link href="#platform" className="hover:text-slate-900">Product</Link>
            <Link href="#pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
          </div>
          <p>© 2026 Rate Radar. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
