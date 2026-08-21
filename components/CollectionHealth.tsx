import { summarize, type RunTelemetry } from '../collector/telemetry';

/**
 * Collection health — how many price attempts actually returned a price, and
 * when they didn't, why. Split by browser and scheduling leg, because the
 * whole point of the transport work is comparing those.
 *
 * Read-only, server-rendered from the telemetry window. The distinction that
 * matters: a rising "blocked" share means the transport needs attention,
 * while rising "no URL resolved" or "no price on page" means the price engine
 * does — a different fix entirely.
 */

// Matches SettingsView's CARD. Flat at rest per DESIGN.md — a shadow means
// interaction or genuine floating, never decoration.
const CARD = 'rounded-xl border border-line bg-card p-md md:p-xl';

const SOURCE_LABEL: Record<string, string> = {
  redroof: 'Our site (direct)',
  google: 'Google Hotels',
  expedia: 'Expedia',
  booking: 'Booking.com (search)',
  'booking-direct': 'Booking.com (per-hotel)',
};

const OUTCOME_LABEL: Record<string, string> = {
  ok: 'priced',
  blocked: 'blocked',
  'no-price': 'no price on page',
  timeout: 'timed out',
  unresolved: 'no URL resolved',
  'sanity-rejected': 'price failed sanity',
  error: 'error',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Blocked share across a set of runs, or null when nothing was attempted. */
function blockedShareOf(runs: RunTelemetry[]): number | null {
  const attempts = runs.flatMap((r) => r.attempts);
  if (attempts.length === 0) return null;
  return summarize(attempts).blockedShare;
}

export default function CollectionHealth({ runs }: { runs: RunTelemetry[] }) {
  if (runs.length === 0) {
    return (
      <section className={CARD}>
        <h3 className="mb-2 font-headline-md text-headline-md text-ink">Collection Health</h3>
        <p className="font-body-md text-body-md text-muted">
          No telemetry recorded yet — it appears after the next collector run.
        </p>
      </section>
    );
  }

  const latest = runs[0];
  const s = summarize(latest.attempts);

  const comparisons: [string, number | null][] = [
    ['Stock Playwright', blockedShareOf(runs.filter((r) => r.browser === 'playwright'))],
    ['Patchright', blockedShareOf(runs.filter((r) => r.browser === 'patchright'))],
    ['GitHub-hosted', blockedShareOf(runs.filter((r) => r.runLeg === 'github-hosted'))],
    ['Self-hosted', blockedShareOf(runs.filter((r) => r.runLeg === 'self-hosted'))],
  ];

  return (
    <section className={CARD}>
      <div className="mb-md flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-headline-md text-headline-md text-ink">Collection Health</h3>
        <span className="font-label-md text-label-md uppercase text-muted">
          {s.ok} of {s.total} attempts priced
        </span>
      </div>

      <p className="mb-md font-body-md text-body-md text-muted">
        Latest run used {latest.browser} on the {latest.runLeg} leg
        {latest.profileAgeRuns > 0
          ? `, browser profile ${latest.profileAgeRuns} run${latest.profileAgeRuns === 1 ? '' : 's'} old`
          : ', fresh browser profile'}
        .
      </p>

      {/* Per-source outcomes. The point is that "blocked" reads differently
          from "no price on page" — they need different fixes. */}
      {s.total === 0 ? (
        <p className="font-body-md text-body-md text-muted">
          The latest run attempted no price checks — likely a rates-skipped run.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(s.bySource).map(([source, counts]) => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            const failures = Object.entries(counts)
              .filter(([outcome, n]) => n > 0 && outcome !== 'ok')
              .map(([outcome, n]) => `${n} ${OUTCOME_LABEL[outcome] ?? outcome}`);
            const allOk = counts.ok === total;
            return (
              <div key={source} className="relative overflow-hidden rounded-lg border border-line bg-paper p-4">
                <div
                  className={`absolute right-0 top-0 h-full w-2 ${
                    allOk ? 'bg-[#029768]' : counts.blocked > 0 ? 'bg-bad' : 'bg-muted'
                  }`}
                />
                <h4 className="font-medium text-ink">{SOURCE_LABEL[source] ?? source}</h4>
                <p className="mt-1 font-label-md text-[11px] uppercase text-muted">
                  {counts.ok}/{total} priced
                </p>
                {failures.length > 0 && <p className="mt-1 text-xs text-muted">{failures.join(' · ')}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* The comparison the transport work exists to make. */}
      <div className="mt-md border-t border-line pt-md">
        <h4 className="mb-2 font-label-md text-label-md uppercase text-muted">
          Blocked rate over the last {runs.length} run{runs.length === 1 ? '' : 's'}
        </h4>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {comparisons.map(([label, share]) => (
            <div key={label} className="rounded-lg border border-line bg-paper p-3">
              <dt className="font-label-md text-[11px] uppercase text-muted">{label}</dt>
              <dd className="mt-1 font-headline-md text-headline-md text-ink">
                {share === null ? '—' : pct(share)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">&ldquo;—&rdquo; means no runs of that kind are in the window yet.</p>
      </div>
    </section>
  );
}
