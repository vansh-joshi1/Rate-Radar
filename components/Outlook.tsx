import type { NightRecommendation } from '../lib/scoring/types';

const chip = (score: number) =>
  score >= 70 ? 'major' : score >= 40 ? 'meaningful' : score >= 15 ? 'minor' : 'none';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

export default function Outlook({ nights }: { nights: NightRecommendation[] }) {
  return (
    <section>
      <h2>Next 3 weeks</h2>
      <table>
        <thead>
          <tr><th>Night</th><th>Signal</th><th>Standard</th><th>Superior</th><th>Driver</th></tr>
        </thead>
        <tbody>
          {nights.map((n) => {
            const std = n.tiers.find((t) => t.tierId === 'standard');
            const q = n.tiers.find((t) => t.tierId === 'superior');
            const top = n.events[0];
            return (
              <tr key={n.date}>
                <td>{fmt(n.date)}</td>
                <td><span className={`chip ${chip(n.nightScore)}`}>{n.nightScore === 0 ? 'quiet' : n.nightScore}</span></td>
                <td>${std?.recommended}{n.upliftPct > 0 ? <span className="muted small"> +{n.upliftPct}%</span> : null}</td>
                <td>${q?.recommended}</td>
                <td className="small muted">
                  {n.holidayName ?? (top ? `${top.name}${top.tier === 'too-small' || top.tier === 'minor' ? ' (unlikely to matter)' : ''}` : 'no demand signal')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
