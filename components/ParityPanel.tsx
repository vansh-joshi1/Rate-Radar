import type { RateCheck } from '../lib/scoring/types';

const LABELS: Record<string, string> = {
  redroof: 'redroof.com (direct)', google: 'Google Hotels (informational — not alerted on)', expedia: 'Expedia', booking: 'Booking.com',
};

export default function ParityPanel({ parity }: { parity: RateCheck[] }) {
  // Google is informational only — excluded from the gap badge (owner request)
  const priced = parity.filter((p) => p.status === 'ok' && typeof p.price === 'number' && p.source !== 'google');
  const gap = priced.length >= 2
    ? Math.max(...priced.map((p) => p.price!)) - Math.min(...priced.map((p) => p.price!))
    : 0;
  const lo = priced.length >= 2 ? Math.min(...priced.map((p) => p.price!)) : 0;
  const gapFlagged = priced.length >= 2 && (gap >= 8 || (gap / lo) * 100 >= 10);

  return (
    <section>
      <h2>
        Our listed rate, by source{' '}
        {gapFlagged && <span className="gap-badge">${gap} gap</span>}
      </h2>
      {parity.length === 0 && <p className="muted small">No rate check data yet this run.</p>}
      <div className="grid cols2">
        {parity.map((p) => (
          <div key={p.source} style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 4, padding: 14 }}>
            <div className="muted small">{LABELS[p.source] ?? p.source}</div>
            {p.status === 'ok' ? (
              <>
                <div className="price price-sm">${p.price}</div>
                {p.room && <div className="muted small">{p.room}</div>}
              </>
            ) : (
              <>
                <div style={{ color: 'var(--warn)', fontWeight: 600, marginTop: 4 }}>needs manual check</div>
                {p.error && <div className="muted small">{p.error}</div>}
              </>
            )}
            <div className="muted small" style={{ marginTop: 4 }}>
              checked {new Date(p.fetchedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
            </div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Sources are reported separately on purpose — a gap between them is itself the signal (rate-parity problem).
      </p>
    </section>
  );
}
