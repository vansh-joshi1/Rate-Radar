import { loadSnapshot } from '../../../lib/dashboard-data';
import { DemandChip, SampleBadge, SectionTitle } from '../../../components/ui';

export const dynamic = 'force-dynamic';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

export default async function Calendar() {
  const { snapshot, isDemo } = await loadSnapshot();

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>{snapshot.nights.length}-night rate forecast</SectionTitle>
        {isDemo && <SampleBadge />}
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Night</th>
                <th className="th">Demand signal</th>
                <th className="th">Standard</th>
                <th className="th">Superior</th>
                <th className="th">Uplift</th>
                <th className="th">Primary driver</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.nights.map((n, i) => {
                const std = n.tiers.find((t) => t.tierId === 'standard') ?? n.tiers[0];
                const sup = n.tiers.find((t) => t.tierId === 'superior');
                const top = n.events[0];
                const driver = n.holidayName
                  ? n.holidayName
                  : top
                    ? `${top.name}${top.tier === 'too-small' || top.tier === 'minor' ? ' (unlikely to matter)' : ''}`
                    : 'No demand signal';
                return (
                  <tr
                    key={n.date}
                    className={`hover:bg-ink/[0.03] ${n.holidayName ? 'bg-accent/5 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent' : ''}`}
                  >
                    <td className="td font-semibold">{i === 0 ? <strong>Tonight</strong> : null} {fmt(n.date)}</td>
                    <td className="td"><DemandChip score={n.nightScore} /></td>
                    <td className="td font-serif text-lg">${std?.recommended}</td>
                    <td className="td font-serif text-lg">${sup?.recommended ?? '—'}</td>
                    <td className={`td font-semibold ${n.upliftPct > 0 ? 'text-ok' : 'text-muted'}`}>
                      {n.upliftPct > 0 ? `+${n.upliftPct}%` : '0%'}
                    </td>
                    <td className={`td ${!n.holidayName && (!top || top.tier === 'too-small') ? 'text-muted' : ''}`}>
                      {driver}
                      {n.weatherNote && <div className="text-xs text-warn">{n.weatherNote}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Events judged too small to matter are shown with that verdict — never silently dropped.
      </p>
    </div>
  );
}
