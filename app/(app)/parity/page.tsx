import { loadSnapshot } from '../../../lib/dashboard-data';
import { demoSparkline } from '../../../lib/demo';
import { SampleBadge, SectionTitle } from '../../../components/ui';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  redroof: 'Direct (your site)',
  google: 'Google Hotels',
  expedia: 'Expedia',
  booking: 'Booking.com',
};

const checkedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT';

export default async function Parity() {
  const { snapshot, isDemo } = await loadSnapshot();
  const parity = snapshot.parity;

  // Google is informational only — excluded from the gap badge (owner request)
  const priced = parity.filter((p) => p.status === 'ok' && typeof p.price === 'number' && p.source !== 'google');
  const direct = priced.find((p) => p.source === 'redroof');
  const gap = priced.length >= 2 ? Math.max(...priced.map((p) => p.price!)) - Math.min(...priced.map((p) => p.price!)) : 0;
  const lo = priced.length >= 2 ? Math.min(...priced.map((p) => p.price!)) : 0;
  const gapFlagged = priced.length >= 2 && (gap >= 8 || (gap / lo) * 100 >= 10);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <SectionTitle>Rate parity monitor</SectionTitle>
            {isDemo && <SampleBadge />}
          </div>
          <p className="-mt-3 text-sm text-muted">Your own listed rate, checked across sources. Google is informational — not alerted on.</p>
        </div>
        <div>
          <div className="mb-1 text-right text-[10px] font-bold uppercase tracking-widest text-muted">30-day parity-gap history</div>
          <div className="flex h-10 w-64 items-end gap-0.5 border border-line bg-ink/[0.02] p-1">
            {demoSparkline.map((h, i) => (
              <div key={i} className={`min-h-[2px] flex-1 ${h >= 60 ? 'bg-bad' : 'bg-line'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {parity.map((p) => {
          const isDirect = p.source === 'redroof';
          const sourceGap = p.status === 'ok' && p.price != null && direct?.price != null && p.source !== 'google'
            ? p.price - direct.price
            : 0;
          return (
            <div key={p.source} className="card relative">
              {gapFlagged && sourceGap === gap && gap > 0 && (
                <div className="absolute right-4 top-4 rounded-sm bg-bad px-2 py-0.5 text-xs font-bold text-white">
                  ${gap} GAP
                </div>
              )}
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                {LABELS[p.source] ?? p.source}
                {p.source === 'google' && <span className="ml-1 normal-case">(informational)</span>}
              </div>
              {p.status === 'ok' ? (
                <>
                  <div className={`my-2 font-serif text-4xl font-semibold ${sourceGap > 0 ? 'text-bad' : ''}`}>${p.price}</div>
                  {p.room && <div className="text-sm">{p.room}</div>}
                  {p.rooms && p.rooms.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-line pt-3">
                      {p.rooms.map((r) => (
                        <div key={r.room} className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate text-muted" title={r.room}>{r.room}</span>
                          <span className="shrink-0 tabular-nums">
                            <span className="font-serif text-sm font-semibold">${r.price}</span>
                            {r.memberPrice != null && <span className="ml-1 text-muted">(${r.memberPrice} member)</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 text-[11px] uppercase tracking-wider text-muted">Checked {checkedAt(p.fetchedAt)}</div>
                  <div className={`mt-2 text-xs font-semibold ${isDirect ? 'text-ok' : sourceGap > 0 ? 'text-bad' : 'text-ok'}`}>
                    {isDirect ? '✓ Baseline source' : sourceGap > 0 ? `⚠ $${sourceGap} above direct` : '✓ In parity'}
                  </div>
                </>
              ) : (
                <>
                  <div className="my-4 font-semibold text-warn">NEEDS MANUAL CHECK</div>
                  <div className="text-sm text-muted">
                    {p.error ?? 'Could not read a price this run.'} This is a truthful state, not a bug — spot-check by hand if it persists.
                  </div>
                  <div className="mt-4 text-[11px] uppercase tracking-wider text-muted">Last attempt {checkedAt(p.fetchedAt)}</div>
                </>
              )}
            </div>
          );
        })}
        {parity.length === 0 && <p className="text-sm text-muted">No rate check data yet this run.</p>}
      </div>
    </div>
  );
}
