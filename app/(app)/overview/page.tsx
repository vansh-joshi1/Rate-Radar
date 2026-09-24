import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle';
import { KeyIcon } from '@phosphor-icons/react/dist/ssr/Key';
import { XCircleIcon } from '@phosphor-icons/react/dist/ssr/XCircle';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowsClockwise';
import { loadSnapshot } from '../../../lib/dashboard-data';
import { loadCurrentRates } from '../../../lib/current-rates';
import { requestPropertyId, requestStore } from '../../../lib/demo/context';
import { Bezel } from '../../../components/landing/Machined';
import { fmtWeekdayLong, fmtRange, fmtDow } from '../../../lib/date';
import type { ScoredEvent, SourceResult } from '../../../lib/scoring/types';

export const dynamic = 'force-dynamic';

/*
 * The dashboard, on the Machined Instrument language (DESIGN.md). It is the
 * first app page to migrate; the rail and top bar around it still render the
 * old treatment until the shell moves too.
 *
 * Layout is a 7/5 bento over a full-width row, then the collector log open on
 * the canvas:
 *
 *   - Tonight's rate (light core). The suggested figure is the page's one
 *     large cobalt verdict; your rate and the gap sit under it, and the next
 *     six nights are a strip of proportional bars.
 *   - Comp set (navy core), because every reading in it is a scraped price.
 *     The suggested rate is slotted into the sorted list so you can see where
 *     it lands among the neighbours without doing arithmetic.
 *   - Demand: tonight's events, strongest first, with the ones the scorer
 *     rejected dimmed rather than dropped, beside a six-night heat strip.
 *
 * Rate entry, parity, reasoning and notes still live on their own pages. The
 * warning banners only render when the data is stale or a source failed.
 */

const relative = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr${hrs === 1 ? '' : 's'} ago` : `${Math.round(hrs / 24)}d ago`;
};

const money = (n: number) => `$${n}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n)}`;

const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';
const DIVIDER = 'h-px bg-[#0b1c30]/[0.06]';
const LINK =
  'rounded-full text-[14px] font-medium text-[#44474d] underline decoration-[#0b1c30]/20 underline-offset-4 transition-colors duration-150 hover:text-[#1a1b20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2';

/* ---- chips (DESIGN.md → Chips, migrated form) ---- */

const CHIP = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium';

function StatusChip({ tone, children }: { tone: 'ok' | 'quiet'; children: React.ReactNode }) {
  return (
    <span
      className={`${CHIP} ${tone === 'ok' ? 'bg-[#029768]/[0.08] text-[#027a55]' : 'bg-[#0b1c30]/[0.05] text-[#44474d]'}`}
    >
      {children}
    </span>
  );
}

/** Reads the scorer's own tier rather than re-deriving it from the score. */
const DEMAND_CHIP: Record<ScoredEvent['tier'], { label: string; tone: string }> = {
  major: { label: 'Major', tone: 'bg-[#085ac0] text-white' },
  meaningful: { label: 'Meaningful', tone: 'bg-[#e5eeff] text-[#085ac0]' },
  minor: { label: 'Minor', tone: 'bg-[#1a1b20]/10 text-[#1a1b20]' },
  'too-small': { label: 'Too small', tone: 'bg-[#0b1c30]/[0.05] text-[#44474d]' },
};

function DemandChip({ event }: { event: ScoredEvent }) {
  const { label, tone } = DEMAND_CHIP[event.tier];
  return <span className={`${CHIP} ${tone}`}>{label}</span>;
}

/* ---- instruments ---- */

/**
 * Six nights of suggested rates. Height is proportional to the value and
 * tonight only changes colour, so the tallest bar is always the dearest night.
 */
function NightStrip({ nights }: { nights: { date: string; rate: number }[] }) {
  const max = Math.max(...nights.map((n) => n.rate));
  const min = Math.min(...nights.map((n) => n.rate));
  const span = max - min || 1;
  return (
    <ol className="grid grid-cols-6 gap-2 rounded-[1.25rem] bg-[#0b1c30]/[0.03] p-3 sm:gap-3 sm:p-4">
      {nights.map((n, i) => (
        <li key={n.date} className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-full items-end" aria-hidden>
            <div
              className={`w-full rounded-[0.5rem] ${i === 0 ? 'bg-[#085ac0]' : 'bg-[#0b1c30]/[0.12]'}`}
              style={{ height: `${35 + ((n.rate - min) / span) * 65}%` }}
            />
          </div>
          <span className={`font-geist-mono text-[11.5px] ${i === 0 ? 'text-[#085ac0]' : 'text-[#44474d]'}`}>
            {i === 0 ? 'Tonight' : fmtDow(n.date)}
          </span>
          <span className="text-[13px] font-medium tabular-nums text-[#1a1b20]">{money(n.rate)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Heat ramp by night score; steps 3 and 4 carry white text. */
function heat(score: number) {
  if (score >= 70) return 'bg-[#131b2e] text-white';
  if (score >= 40) return 'bg-[#085ac0] text-white';
  if (score >= 15) return 'bg-[#d8e2ff] text-[#0b1c30]';
  return 'bg-[#d3e4fe]/60 text-[#44474d]';
}

function LogRow({ source }: { source: SourceResult }) {
  const { status, error } = source;
  const text =
    status === 'ok'
      ? `${source.source} synced.`
      : status === 'awaiting-key'
        ? `${source.source} skipped. No API key is configured.`
        : `${source.source} failed${error ? `: ${error.slice(0, 110)}` : '.'}`;
  const icon =
    status === 'ok' ? (
      <CheckCircleIcon weight="light" className="h-4 w-4 text-[#029768]" />
    ) : status === 'awaiting-key' ? (
      <KeyIcon weight="light" className="h-4 w-4 text-[#44474d]" />
    ) : (
      <XCircleIcon weight="light" className="h-4 w-4 text-[#ba1a1a]" />
    );
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b1c30]/[0.05]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 pt-1">
        <p className={`text-[14.5px] leading-snug ${status === 'awaiting-key' ? 'text-[#44474d]' : 'text-[#1a1b20]'}`}>
          {text}
        </p>
        <span className={`${MONO_LABEL} mt-0.5 block tabular-nums`}>
          {new Date(source.fetchedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
        </span>
      </div>
    </li>
  );
}

function Banner({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[1.25rem] bg-[#b45309]/[0.06] px-5 py-4 ring-1 ring-[#b45309]/25"
    >
      <WarningIcon weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-[#b45309]" aria-hidden />
      <div className="min-w-0 text-[14.5px] leading-relaxed text-[#1a1b20]">
        <p className="font-semibold text-[#8a3f07]">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default async function Overview() {
  const { snapshot, isDemo } = await loadSnapshot();

  const night = snapshot.nights[0];
  const std = night.tiers.find((t) => t.tierId === 'standard') ?? night.tiers[0];
  const ageHours = (Date.now() - new Date(snapshot.runAt).getTime()) / 3600_000;
  const failed = snapshot.sources.filter((s) => s.status !== 'ok');

  // Your rate: owner-entered is authoritative (you set your prices); the
  // scraped redroof.com value fills in when the owner hasn't entered one.
  // Read unconditionally: outside a demo this is the owner's real entry, and
  // inside one it is whatever the visitor typed into their own sandbox. Both
  // are absent until somebody sets a rate, and the null path already handles that.
  const ownerRates = await loadCurrentRates(requestStore(), requestPropertyId());
  const directRooms = snapshot.parity.find((p) => p.official && p.status === 'ok')?.rooms ?? [];
  const ownerStd = ownerRates?.tiers[std.tierId];
  const scraped = directRooms.filter((r) => r.tierId === std.tierId).map((r) => r.price);
  const yourRate = ownerStd ?? (scraped.length > 0 ? Math.min(...scraped) : null);
  const delta = yourRate != null ? std.recommended - yourRate : null;

  const upcoming = snapshot.nights.slice(0, 6);
  const strip = upcoming.map((n) => ({
    date: n.date,
    rate: (n.tiers.find((t) => t.tierId === std.tierId) ?? n.tiers[0]).recommended,
  }));

  const compset = snapshot.compsets?.[0] ?? snapshot.compset;
  const compsetMedian = compset?.median ?? null;
  const neighbours = [...(compset?.entries ?? [])].sort((a, b) => a.price - b.price);
  const shownNeighbours = neighbours.slice(0, 7);
  // Where the suggested rate would sit in the sorted list.
  const slot = shownNeighbours.findIndex((e) => e.price > std.recommended);
  const insertAt = slot === -1 ? shownNeighbours.length : slot;

  const events = [...night.events].sort((a, b) => b.score - a.score);
  const shownEvents = events.slice(0, 4);
  const confidence = Math.round(snapshot.confidence);

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} space-y-8 font-geist text-[#1a1b20] antialiased`}>
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-tighter md:text-[40px]">
            {fmtWeekdayLong(night.date)}
          </h1>
          <p className="mt-2 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
            Tonight&apos;s suggested rate, what the neighbours charge, and the demand behind it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isDemo ? <StatusChip tone="quiet">Sample data</StatusChip> : <StatusChip tone="ok">Live</StatusChip>}
          <span className="rounded-full bg-white px-3.5 py-1.5 font-geist-mono text-[12.5px] tabular-nums text-[#1a1b20] ring-1 ring-[#0b1c30]/[0.08]">
            {fmtRange(upcoming[0].date, upcoming[upcoming.length - 1].date)}
          </span>
        </div>
      </header>

      {(ageHours > 6 || failed.length > 0) && (
        <div className="space-y-3">
          {ageHours > 6 && (
            <Banner title="The data is stale">
              <p>
                The last collector run finished {Math.round(ageHours)} hours ago, so the collector may not be running.
                Check GitHub Actions.
              </p>
            </Banner>
          )}
          {failed.length > 0 && (
            <Banner title={failed.length === 1 ? 'One source did not report' : `${failed.length} sources did not report`}>
              <ul className="mt-1 space-y-0.5 text-[#44474d]">
                {failed.map((s) => (
                  <li key={s.source} className="break-words">
                    <span className="font-medium text-[#1a1b20]">{s.source}</span>{' '}
                    {s.status === 'awaiting-key' ? 'is waiting for an API key.' : `failed${s.error ? `: ${s.error.slice(0, 90)}` : '.'}`}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Tonight's rate */}
        <Bezel className="lg:col-span-7" core="flex h-full flex-col gap-6 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={MONO_LABEL}>Suggested rate, {std.label}</span>
              <p className="mt-1 text-[56px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0] md:text-[72px]">
                {money(std.recommended)}
              </p>
              <span className={`${MONO_LABEL} mt-3 block tabular-nums`}>
                Range {money(std.range[0])} to {money(std.range[1])}
              </span>
            </div>
            <div className="text-right">
              <span className={MONO_LABEL}>Confidence</span>
              <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{confidence}%</p>
            </div>
          </div>

          <div className={DIVIDER} />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className={MONO_LABEL}>Your rate</span>
              {yourRate != null ? (
                <p className="mt-1 text-[28px] font-semibold tracking-tight tabular-nums">{money(yourRate)}</p>
              ) : (
                <p className="mt-2 text-[14.5px] leading-snug text-[#44474d]">
                  Not set.{' '}
                  <Link href="/settings" className={LINK}>
                    Add it in Settings
                  </Link>
                </p>
              )}
            </div>
            <div>
              <span className={MONO_LABEL}>Gap to suggested</span>
              {delta != null ? (
                <>
                  <p
                    className={`mt-1 text-[28px] font-semibold tracking-tight tabular-nums ${
                      delta > 0 ? 'text-[#029768]' : delta < 0 ? 'text-[#b45309]' : 'text-[#1a1b20]'
                    }`}
                  >
                    {delta === 0 ? '$0' : signed(delta)}
                  </p>
                  <p className="text-[13px] text-[#44474d]">
                    {delta > 0 ? 'Room to raise tonight' : delta < 0 ? 'You are above the suggestion' : 'Matched'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[14.5px] text-[#44474d]">Needs your rate first</p>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <span className={`${MONO_LABEL} mb-3 block`}>Next six nights, suggested</span>
            <NightStrip nights={strip} />
          </div>
        </Bezel>

        {/* Comp set: every figure here was scraped, so the core is navy. */}
        <Bezel tone="data" className="lg:col-span-5" core="flex h-full flex-col p-6 text-white md:p-8">
          <span className="font-geist-mono text-[12px] text-[#adc6ff]">
            Comp set median{compset ? `, ${compset.entries.length} nearby` : ''}
          </span>
          {compsetMedian != null ? (
            <>
              <p className="mt-1 text-[48px] font-semibold leading-none tracking-tighter tabular-nums md:text-[56px]">
                {money(compsetMedian)}
              </p>
              <p className="mt-3 text-[14.5px] text-white/70">
                {std.recommended === compsetMedian
                  ? 'The suggestion sits exactly on the median.'
                  : `The suggestion is ${money(Math.abs(std.recommended - compsetMedian))} ${
                      std.recommended > compsetMedian ? 'above' : 'below'
                    } it.`}
              </p>

              <ol className="mt-6 divide-y divide-white/[0.08]">
                {shownNeighbours.map((e, i) => (
                  <li key={`${e.name}-${i}`}>
                    {i === insertAt && <SuggestedRow rate={std.recommended} />}
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <span className="truncate text-[14px] text-white/80">{e.name}</span>
                      <span className="font-geist-mono text-[14px] tabular-nums">{money(e.price)}</span>
                    </div>
                  </li>
                ))}
                {insertAt === shownNeighbours.length && (
                  <li>
                    <SuggestedRow rate={std.recommended} />
                  </li>
                )}
              </ol>

              <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                <span className="font-geist-mono text-[12px] text-white/50">
                  {neighbours.length > shownNeighbours.length
                    ? `${neighbours.length - shownNeighbours.length} more not shown`
                    : `Prices for ${fmtDow(compset!.date)}`}
                </span>
                <Link
                  href="/competitors"
                  className="rounded-full text-[14px] font-medium text-[#adc6ff] underline decoration-[#adc6ff]/30 underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#adc6ff]/50"
                >
                  Competitor insights
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 max-w-[40ch] text-[14.5px] leading-relaxed text-white/60">
              No competitor prices came back this run. The comp set bound was skipped, not guessed.
            </p>
          )}
        </Bezel>

        {/* Demand */}
        <Bezel className="lg:col-span-12" core="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="p-6 md:p-8">
            <h2 className="text-[22px] font-semibold tracking-tight">Tonight&apos;s demand</h2>
            {shownEvents.length > 0 ? (
              <ul className="mt-4 divide-y divide-[#0b1c30]/[0.06]">
                {shownEvents.map((e) => {
                  const rejected = e.tier === 'too-small';
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-3">
                      <DemandChip event={e} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-pretty text-[14.5px] font-medium leading-snug ${rejected ? 'text-[#44474d]' : ''}`}>
                          {e.name}
                        </p>
                        <p className="mt-0.5 text-pretty text-[13px] leading-snug text-[#44474d]">{e.verdict}</p>
                        {/* On phones the score drops under the verdict instead of squeezing the name. */}
                        <span className={`${MONO_LABEL} mt-1 block tabular-nums sm:hidden`}>Score {e.score}</span>
                      </div>
                      <span className={`${MONO_LABEL} hidden shrink-0 tabular-nums sm:block`}>Score {e.score}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d]">
                No events tonight. The rate falls back to your day-of-week baseline.
              </p>
            )}
            {events.length > shownEvents.length && (
              <Link href="/calendar" className={`${LINK} mt-3 inline-block`}>
                {events.length - shownEvents.length} more on the calendar
              </Link>
            )}
          </div>

          <div className="border-t border-[#0b1c30]/[0.06] p-6 md:p-8 lg:border-l lg:border-t-0">
            <span className={MONO_LABEL}>Night score, next six nights</span>
            <ol className="mt-3 grid grid-cols-6 gap-2">
              {upcoming.map((n, i) => (
                <li key={n.date} className="flex flex-col items-center gap-2">
                  <span
                    className={`flex aspect-square w-full items-center justify-center rounded-[0.5rem] font-geist-mono text-[13px] tabular-nums ${heat(
                      n.nightScore,
                    )}`}
                    title={n.holidayName ?? undefined}
                  >
                    {Math.round(n.nightScore)}
                  </span>
                  <span className={`font-geist-mono text-[11.5px] ${i === 0 ? 'text-[#085ac0]' : 'text-[#44474d]'}`}>
                    {i === 0 ? 'Tonight' : fmtDow(n.date)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] leading-relaxed text-[#44474d]">
              Scores run 0 to 100. Darker cells are nights with more draw from events, holidays and weather.
            </p>
          </div>
        </Bezel>
      </div>

      {/* Collector log: a list, so it sits open on the canvas. */}
      <section aria-labelledby="log-heading" className="pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="log-heading" className="text-[22px] font-semibold tracking-tight">
            Collector log
          </h2>
          <span className={`${MONO_LABEL} inline-flex items-center gap-1.5`}>
            <ArrowsClockwiseIcon weight="light" className="h-3.5 w-3.5" aria-hidden />
            Run {snapshot.runId}, {relative(snapshot.runAt)}
          </span>
        </div>
        <ul className="mt-2 divide-y divide-[#0b1c30]/[0.06]">
          {snapshot.sources.slice(0, 3).map((s) => (
            <LogRow key={s.source} source={s} />
          ))}
        </ul>
        {snapshot.sources.length > 3 && (
          <details className="group flex flex-col">
            {/* The toggle is ordered last so "Show fewer" sits under the rows it hides. */}
            <summary className="order-last mt-2 inline-flex w-fit cursor-pointer list-none items-center rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08] transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#f3f5fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 active:scale-[0.98] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show {snapshot.sources.length - 3} more</span>
              <span className="hidden group-open:inline">Show fewer</span>
            </summary>
            <ul className="mt-2 divide-y divide-[#0b1c30]/[0.06] border-t border-[#0b1c30]/[0.06]">
              {snapshot.sources.slice(3).map((s) => (
                <LogRow key={s.source} source={s} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function SuggestedRow({ rate }: { rate: number }) {
  return (
    <div className="-mx-3 flex items-baseline justify-between gap-4 rounded-full bg-white/[0.06] px-3 py-2.5">
      <span className="text-[14px] font-medium text-[#adc6ff]">Suggested for you</span>
      <span className="font-geist-mono text-[14px] font-medium tabular-nums text-[#adc6ff]">{money(rate)}</span>
    </div>
  );
}
