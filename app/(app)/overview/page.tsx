import Link from 'next/link';
import { loadSnapshot } from '../../../lib/dashboard-data';
import { getStore } from '../../../lib/store';
import { chicagoToday } from '../../../lib/ingest';
import NoteBox from '../../../components/NoteBox';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';
import { WarnIcon } from '../../../components/shell/Icons';

export const dynamic = 'force-dynamic';

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

export default async function Overview() {
  const { snapshot, isDemo } = await loadSnapshot();
  const today = chicagoToday();
  const note = isDemo ? '' : ((await getStore().hget<string>('notes', today)) ?? '');

  const night = snapshot.nights[0];
  const std = night.tiers.find((t) => t.tierId === 'standard') ?? night.tiers[0];
  const superior = night.tiers.find((t) => t.tierId === 'superior');
  const ageHours = (Date.now() - new Date(snapshot.runAt).getTime()) / 3600_000;
  const failed = snapshot.sources.filter((s) => s.status !== 'ok');

  // Your actual listed rate per tier (scraped from redroof.com, tomorrow night)
  const directRooms = snapshot.parity.find((p) => p.source === 'redroof' && p.status === 'ok')?.rooms ?? [];
  const listedFor = (tierId: string): number | undefined => {
    const prices = directRooms.filter((r) => r.tierId === tierId).map((r) => r.price);
    return prices.length > 0 ? Math.min(...prices) : undefined;
  };
  const listedStd = listedFor(std.tierId);
  const listedSup = superior ? listedFor(superior.tierId) : undefined;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Tonight — {fmtDate(night.date)}</SectionTitle>
        {isDemo ? <SampleBadge /> : <Chip tone="ok">Actionable</Chip>}
      </div>

      {ageHours > 6 && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border-l-4 border-warn bg-warn/10 p-4 text-sm">
          <WarnIcon className="shrink-0 text-warn" />
          <span><strong>Stale data:</strong> last run {Math.round(ageHours)}h ago — the collector may not be running. Check GitHub Actions.</span>
        </div>
      )}
      {failed.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border-l-4 border-warn bg-warn/10 p-4 text-sm">
          <WarnIcon className="shrink-0 text-warn" />
          <span>
            <strong>Source warning:</strong>{' '}
            {failed.map((s) => `${s.source} (${s.status}${s.error ? `: ${s.error.slice(0, 90)}` : ''})`).join(' · ')}
          </span>
        </div>
      )}

      <div className="card mb-6">
        <div className="grid items-start gap-8 md:grid-cols-[1fr_1.5fr]">
          <div className="py-6 text-center md:border-r md:border-line">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">{std.label}</div>
            <div className="my-2 font-serif text-7xl font-semibold leading-none text-accent">${std.recommended}</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">Recommended rate</div>
            <div className="mt-1.5 font-semibold text-ok">{night.upliftPct > 0 ? `+${night.upliftPct}% uplift` : 'baseline'}</div>
            <div className="mt-1.5 text-sm text-muted">Range: ${std.range[0]} – ${std.range[1]}</div>
            {listedStd != null && (
              <div className={`mt-2 text-sm font-semibold ${Math.abs(listedStd - std.recommended) > 3 ? 'text-warn' : 'text-muted'}`}>
                Listed on redroof.com: ${listedStd} <span className="font-normal text-muted">(tomorrow night)</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-4 text-base font-semibold">Reasoning</h3>
            <ul className="space-y-2 text-[15px]">
              {night.reasoning.map((r, i) => (
                <li
                  key={i}
                  className={`relative pl-5 before:absolute before:left-0 before:text-accent before:content-['•'] ${
                    r.includes('too small') ? 'text-muted' : ''
                  }`}
                >
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span>Confidence</span>
                <span>{snapshot.confidence}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-ok" style={{ width: `${snapshot.confidence}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{snapshot.confidenceNote}</p>
            </div>
          </div>
        </div>

        {superior && (
          <>
            <hr className="divider" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{superior.label}</div>
                <div className="font-serif text-3xl font-semibold">${superior.recommended}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Recommended rate</div>
                <div className="mt-1 text-sm text-muted">
                  +${superior.recommended - std.recommended} premium over standard · range ${superior.range[0]}–${superior.range[1]}
                  {listedSup != null && <> · listed ${listedSup}</>}
                </div>
              </div>
              <div className="self-end text-left sm:text-right">
                <p className="text-xs text-muted">
                  Rate Radar never changes a price anywhere — enter rates in your own system.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {snapshot.parity.length > 0 && (() => {
        const LABELS: Record<string, string> = {
          redroof: 'Direct (your site)', expedia: 'Expedia', booking: 'Booking.com', google: 'Google Hotels',
        };
        const priced = snapshot.parity.filter((p) => p.status === 'ok' && p.price != null && p.source !== 'google');
        const gap = priced.length >= 2 ? Math.max(...priced.map((p) => p.price!)) - Math.min(...priced.map((p) => p.price!)) : 0;
        const lo = priced.length >= 2 ? Math.min(...priced.map((p) => p.price!)) : 0;
        const flagged = priced.length >= 2 && (gap >= 8 || (gap / lo) * 100 >= 10);
        return (
          <div className="card mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold tracking-tight">
                Your listed rate by source
                {flagged && <span className="ml-2 rounded-full bg-bad px-2.5 py-0.5 text-xs font-bold text-white">${gap} gap</span>}
              </h3>
              <Link href="/parity" className="text-sm font-semibold text-accent">Full parity monitor →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {snapshot.parity.map((p) => (
                <div key={p.source} className="rounded-lg border border-line bg-paper/60 p-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {LABELS[p.source] ?? p.source}
                    {p.source === 'google' && ' (info only)'}
                  </div>
                  {p.status === 'ok' ? (
                    <div className="mt-1 font-serif text-2xl font-semibold">${p.price}</div>
                  ) : (
                    <div className="mt-1.5 text-xs font-semibold text-warn">NEEDS MANUAL CHECK</div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Checked for tomorrow night — cheapest public rate per source.</p>
          </div>
        );
      })()}

      <NoteBox date={today} initial={note} />

      <p className="mt-6 text-sm text-muted">
        Last run {new Date(snapshot.runAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT · run {snapshot.runId}
      </p>
    </div>
  );
}
