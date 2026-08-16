import type { RateCheck } from '../lib/scoring/types';

/*
 * Your own listed rate across every public source we check. Lives on the
 * Competitors page — the dashboard shows the recommendation, this shows where
 * your price is actually visible to guests, and whether the sources disagree.
 */

const LABELS: Record<string, string> = {
  redroof: 'Direct (your site)',
  expedia: 'Expedia',
  booking: 'Booking.com',
  google: 'Google Hotels',
};

export default function ParityGrid({ parity }: { parity: RateCheck[] }) {
  if (parity.length === 0) return null;

  // Google is informational only — it aggregates, so it isn't a parity signal.
  const priced = parity.filter((p) => p.status === 'ok' && p.price != null && p.source !== 'google');
  const prices = priced.map((p) => p.price!);
  const gap = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
  const lo = prices.length >= 2 ? Math.min(...prices) : 0;
  const flagged = prices.length >= 2 && (gap >= 8 || (gap / lo) * 100 >= 10);

  return (
    <div className="rounded-lg border border-line bg-card p-md">
      <h3 className="mb-md font-headline-md text-headline-md text-ink">
        Your listed rate by source
        {flagged && (
          <span className="ml-2 rounded-full bg-bad px-2.5 py-0.5 text-xs font-bold text-white">${gap} gap</span>
        )}
      </h3>
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        {parity.map((p) => (
          <div key={p.source} className="rounded-lg border border-line bg-paper/60 p-sm">
            <div className="font-label-md text-[10px] uppercase tracking-widest text-muted">
              {LABELS[p.source] ?? p.source}
              {p.source === 'google' && ' (info only)'}
            </div>
            {p.status === 'ok' ? (
              <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">${p.price}</div>
            ) : (
              <div className="mt-1.5 text-xs font-semibold text-warn">NEEDS MANUAL CHECK</div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-sm text-xs text-muted">Checked for tomorrow night — cheapest public rate per source.</p>
    </div>
  );
}
