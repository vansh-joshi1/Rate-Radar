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

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Tonight — {fmtDate(night.date)}</SectionTitle>
        {isDemo ? <SampleBadge /> : <Chip tone="ok">Actionable</Chip>}
      </div>

      {ageHours > 6 && (
        <div className="mb-5 flex items-center gap-3 border-l-4 border-warn bg-warn/10 p-4 text-sm">
          <WarnIcon className="shrink-0 text-warn" />
          <span><strong>Stale data:</strong> last run {Math.round(ageHours)}h ago — the collector may not be running. Check GitHub Actions.</span>
        </div>
      )}
      {failed.length > 0 && (
        <div className="mb-5 flex items-center gap-3 border-l-4 border-warn bg-warn/10 p-4 text-sm">
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
            <div className="font-semibold text-ok">{night.upliftPct > 0 ? `+${night.upliftPct}% uplift` : 'baseline'}</div>
            <div className="mt-1.5 text-sm text-muted">Range: ${std.range[0]} – ${std.range[1]}</div>
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
              <div className="h-2 overflow-hidden border border-line bg-paper">
                <div className="h-full bg-ok" style={{ width: `${snapshot.confidence}%` }} />
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
                <div className="text-sm text-muted">
                  +${superior.recommended - std.recommended} premium over standard · range ${superior.range[0]}–${superior.range[1]}
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

      <NoteBox date={today} initial={note} />

      <p className="mt-6 text-sm text-muted">
        Last run {new Date(snapshot.runAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT · run {snapshot.runId}
      </p>
    </div>
  );
}
