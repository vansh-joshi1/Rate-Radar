import { loadSnapshot } from '../../../lib/dashboard-data';
import { loadCurrentRates } from '../../../lib/current-rates';
import { DEFAULT_PROPERTY_ID } from '../../../lib/properties';
import { getStore } from '../../../lib/store';
import { Chip, SampleBadge } from '../../../components/ui';

export const dynamic = 'force-dynamic';

/*
 * Executive dashboard, built to the supplied design: a page header with a date
 * range, a 12-column bento of three stat cards, and a full-width system log.
 * The layout is the mock's; every figure is read from the live snapshot.
 *
 * Rate entry, parity, reasoning and notes deliberately live elsewhere now
 * (Settings, Competitors, Rate Calendar, Alerts) so this page stays the
 * at-a-glance surface the design intends.
 *
 * The two warning banners are the one addition, and they are conditional: when
 * the collector is healthy nothing renders and the page is exactly the mock.
 * They only appear when the data is stale or a source failed — the moment
 * every number below becomes untrustworthy.
 */

const Icon = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`} {...(fill ? { 'data-weight': 'fill' } : {})} aria-hidden>
    {name}
  </span>
);

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

const fmtRange = (from: string, to: string) => {
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
  const a = new Date(`${from}T12:00:00Z`).toLocaleDateString('en-US', opts);
  const b = new Date(`${to}T12:00:00Z`).toLocaleDateString('en-US', opts);
  return `${a} - ${b}, ${new Date(`${to}T12:00:00Z`).getUTCFullYear()}`;
};

const relative = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr${hrs === 1 ? '' : 's'} ago` : `${Math.round(hrs / 24)}d ago`;
};

const CARD =
  'bg-card border border-line rounded-lg p-md transition-all duration-300 hover:shadow-hover-lift';
const STAT = `${CARD} hover:scale-[1.02]`;

/* The design's six-bar chart.
 *
 * Height is always proportional to the value and `highlight` only changes the
 * colour. An earlier version forced the highlighted bar to 100%, which drew
 * tonight as the tallest bar even on nights when it was the cheapest of the
 * six — a chart that contradicted the number printed directly above it. */
function Bars({ values, highlight, tone = 'accent' }: { values: number[]; highlight: number; tone?: 'accent' | 'line' }) {
  if (values.length === 0) return <div className="mt-md h-8" />;
  const shown = values.slice(0, 6);
  const max = Math.max(...shown);
  const min = Math.min(...shown);
  const span = max - min || 1;
  return (
    <div className="mt-md flex h-8 items-end gap-1" aria-hidden>
      {shown.map((v, i) => (
        <div
          key={i}
          title={`$${v}`}
          className={`w-1/6 rounded-t ${
            i === highlight ? (tone === 'accent' ? 'bg-accent' : 'bg-line') : 'bg-ink/10'
          }`}
          style={{ height: `${35 + ((v - min) / span) * 65}%` }}
        />
      ))}
    </div>
  );
}

function LogRow({ source, status, error, at }: { source: string; status: string; error?: string; at: string }) {
  const icon = status === 'ok' ? 'sync' : status === 'awaiting-key' ? 'key_off' : 'error';
  const text =
    status === 'ok'
      ? `${source} sync completed successfully.`
      : status === 'awaiting-key'
        ? `${source} skipped — API key not configured.`
        : `${source} failed${error ? `: ${error.slice(0, 110)}` : '.'}`;
  return (
    <div className="-mx-sm flex gap-sm rounded border-b border-line/50 px-sm py-sm transition-colors last:border-0 hover:bg-paper">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-paper">
        <span
          className={`material-symbols-outlined text-[14px] ${status === 'ok' ? 'text-muted' : 'text-warn'}`}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="font-body-md text-body-md text-ink">{text}</p>
        <span className="font-label-md text-[10px] uppercase text-muted">
          {new Date(at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT • System
        </span>
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
  const ownerRates = isDemo ? null : await loadCurrentRates(getStore(), DEFAULT_PROPERTY_ID);
  const directRooms = snapshot.parity.find((p) => p.source === 'redroof' && p.status === 'ok')?.rooms ?? [];
  const ownerStd = ownerRates?.tiers[std.tierId];
  const scraped = directRooms.filter((r) => r.tierId === std.tierId).map((r) => r.price);
  const yourRate = ownerStd ?? (scraped.length > 0 ? Math.min(...scraped) : null);

  const upcoming = snapshot.nights.slice(0, 6);
  const upcomingRates = upcoming.map(
    (n) => (n.tiers.find((t) => t.tierId === std.tierId) ?? n.tiers[0]).recommended,
  );
  const compset = snapshot.compsets?.[0] ?? snapshot.compset;
  const compsetMedian = compset?.median ?? null;
  const topEvent = [...night.events].sort((a, b) => b.score - a.score)[0];
  const delta = yourRate != null ? std.recommended - yourRate : null;
  const peakIdx = upcoming.reduce((best, n, i) => (n.nightScore > upcoming[best].nightScore ? i : best), 0);

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-md sm:flex-row sm:items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile text-ink md:text-headline-lg">
            Executive Overview
          </h2>
          <p className="mt-1 font-body-md text-body-md text-muted">
            Live demand signals and transparent rate reasoning for {fmtDate(night.date)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          {isDemo ? <SampleBadge /> : <Chip tone="ok">Actionable</Chip>}
          <span className="whitespace-nowrap font-label-md text-label-md uppercase text-muted">Date Range:</span>
          <span className="flex items-center gap-sm rounded border border-line bg-card px-sm py-xs">
            <span className="font-data-mono text-data-mono tabular-nums text-ink">
              {fmtRange(upcoming[0].date, upcoming[upcoming.length - 1].date)}
            </span>
          </span>
        </div>
      </div>

      {ageHours > 6 && (
        <div className="flex items-start gap-sm rounded-lg border border-warn/40 bg-warn/10 p-md font-body-md text-body-md">
          <Icon name="warning" className="mt-px shrink-0 text-warn" />
          <span>
            <strong>Stale data:</strong> last run {Math.round(ageHours)}h ago — the collector may not be running.
            Check GitHub Actions.
          </span>
        </div>
      )}
      {failed.length > 0 && (
        <div className="flex items-start gap-sm rounded-lg border border-warn/40 bg-warn/10 p-md font-body-md text-body-md">
          <Icon name="warning" className="mt-px shrink-0 text-warn" />
          <span>
            <strong>Source warning:</strong>{' '}
            {failed.map((s) => `${s.source} (${s.status}${s.error ? `: ${s.error.slice(0, 90)}` : ''})`).join(' · ')}
          </span>
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-4 gap-md md:grid-cols-8 md:gap-lg lg:grid-cols-12">
        {/* Rate Analysis */}
        <div className={`col-span-4 md:col-span-4 lg:col-span-4 ${STAT}`}>
          <div className="mb-sm flex items-start justify-between">
            <span className="font-label-md text-label-md uppercase text-muted">Rate Analysis</span>
            <Icon name="payments" className="text-accent" />
          </div>
          <div className="flex flex-col gap-xs">
            <div className="flex items-baseline justify-between">
              <span className="font-label-md text-label-md uppercase text-muted">Your Rate</span>
              <span className="font-headline-md text-headline-md tabular-nums text-ink">
                {yourRate != null ? `$${yourRate}` : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-label-md text-label-md uppercase text-muted">Suggested Rate</span>
              <span className="font-headline-md text-headline-md tabular-nums text-accent">${std.recommended}</span>
            </div>
          </div>
          <div className="mt-sm flex items-center gap-xs">
            {delta === null ? (
              <span className="font-body-md text-body-md text-muted">No rate on file — set yours in Settings</span>
            ) : (
              <>
                <span
                  className={`font-data-mono text-data-mono font-bold tabular-nums ${
                    delta > 0 ? 'text-ok' : delta < 0 ? 'text-warn' : 'text-muted'
                  }`}
                >
                  {delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)}
                </span>
                <span className="font-body-md text-body-md text-muted">
                  {delta > 0 ? 'optimization opportunity' : delta < 0 ? 'above recommendation' : 'matched'}
                </span>
              </>
            )}
          </div>
          <Bars values={upcomingRates} highlight={0} />
        </div>

        {/* Comp Set */}
        <div className={`col-span-4 md:col-span-4 lg:col-span-4 ${STAT}`}>
          <div className="mb-sm flex items-start justify-between">
            <span className="font-label-md text-label-md uppercase text-muted">Comp Set Median</span>
            <Icon name="analytics" className="text-accent" />
          </div>
          <div className="flex items-baseline gap-sm">
            <span className="font-headline-xl text-headline-xl tabular-nums text-ink">
              {compsetMedian != null ? `$${compsetMedian}` : '—'}
            </span>
          </div>
          <div className="mt-sm flex items-center gap-xs">
            {compsetMedian != null ? (
              <>
                <span
                  className={`font-data-mono text-data-mono font-bold tabular-nums ${
                    std.recommended >= compsetMedian ? 'text-ok' : 'text-muted'
                  }`}
                >
                  {std.recommended >= compsetMedian ? '+' : '−'}${Math.abs(std.recommended - compsetMedian)}
                </span>
                <span className="font-body-md text-body-md text-muted">
                  recommended vs {compset?.entries.length ?? 0} nearby
                </span>
              </>
            ) : (
              <span className="font-body-md text-body-md text-muted">
                No competitor prices this run — bound skipped, not guessed
              </span>
            )}
          </div>
          <Bars values={compset?.entries.map((e) => e.price) ?? []} highlight={-1} tone="line" />
        </div>

        {/* Market Events */}
        <div className={`col-span-4 md:col-span-8 lg:col-span-4 ${STAT}`}>
          <div className="mb-sm flex items-start justify-between">
            <span className="font-label-md text-label-md uppercase text-muted">Market Events</span>
            <Icon name="calendar_today" className="text-accent" />
          </div>
          {topEvent ? (
            <>
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm">
                  <span
                    className={`rounded px-sm py-xs text-[10px] font-bold uppercase tracking-wider ${
                      topEvent.score >= 40 ? 'bg-accent text-white' : 'bg-ink/10 text-muted'
                    }`}
                  >
                    {topEvent.tier === 'too-small' ? 'Too small to matter' : `${topEvent.tier} · score ${topEvent.score}`}
                  </span>
                </div>
                <span className="mt-xs font-headline-md text-headline-md text-ink">{topEvent.name}</span>
              </div>
              <div className="mt-sm flex items-center gap-xs">
                <span className="font-body-md text-body-md text-muted">{topEvent.verdict}</span>
              </div>
            </>
          ) : (
            <>
              <span className="font-headline-md text-headline-md text-ink">No events tonight</span>
              <div className="mt-sm">
                <span className="font-body-md text-body-md text-muted">
                  Rate falls back to your day-of-week baseline
                </span>
              </div>
            </>
          )}
          <Bars values={upcoming.map((n) => Math.max(1, n.nightScore))} highlight={peakIdx} />
        </div>

        {/* System Log — "View All Logs" sits inside <summary> because that is
            the only part of <details> that renders while collapsed. */}
        <div className={`col-span-4 flex h-full flex-col md:col-span-8 lg:col-span-12 ${CARD}`}>
          <h3 className="mb-md font-headline-md text-headline-md text-ink">System Log</h3>
          <details className="group flex-1">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {snapshot.sources.slice(0, 3).map((s) => (
                <LogRow key={s.source} source={s.source} status={s.status} error={s.error} at={s.fetchedAt} />
              ))}
              {snapshot.sources.length > 3 && (
                <span className="mt-md block w-full text-center font-label-md text-label-md uppercase text-accent hover:underline group-open:hidden">
                  View All Logs
                </span>
              )}
            </summary>
            {snapshot.sources.slice(3).map((s) => (
              <LogRow key={s.source} source={s.source} status={s.status} error={s.error} at={s.fetchedAt} />
            ))}
            <div className="flex gap-sm rounded px-sm py-sm">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-paper">
                <Icon name="schedule" className="text-[14px] text-muted" />
              </div>
              <div>
                <p className="font-body-md text-body-md text-ink">Collector run {snapshot.runId} completed.</p>
                <span className="font-label-md text-[10px] uppercase text-muted">
                  {relative(snapshot.runAt)} • System
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
