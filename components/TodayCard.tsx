import type { NightRecommendation } from '../lib/scoring/types';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

export default function TodayCard({
  night, confidence, confidenceNote,
}: {
  night: NightRecommendation; confidence: number; confidenceNote: string;
}) {
  return (
    <section>
      <h2>Tonight — {fmt(night.date)}</h2>
      <div className="grid cols2">
        {night.tiers.map((t) => (
          <div key={t.tierId}>
            <div className="muted small">{t.label}</div>
            <div className="price">${t.recommended}</div>
            <div className="muted small">range ${t.range[0]}–${t.range[1]}{night.upliftPct > 0 ? ` · +${night.upliftPct}% over baseline` : ' · baseline'}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="muted small" style={{ marginBottom: 4 }}>Confidence: {confidence}% — {confidenceNote}</div>
        <div className="confbar"><div style={{ width: `${confidence}%` }} /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>Reasoning</div>
        <ul style={{ paddingLeft: 18, display: 'grid', gap: 4 }}>
          {night.reasoning.map((r, i) => (
            <li key={i} className={r.includes('too small') ? 'reason-toosmall small' : 'small'}>{r}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
