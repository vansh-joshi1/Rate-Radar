import type { CompsetInfo } from '../lib/scoring/types';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

function Block({ c }: { c: CompsetInfo }) {
  if (c.entries.length === 0) {
    return <p className="muted small">No competitor prices captured for {fmt(c.date)} this run.</p>;
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="small" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <strong>{fmt(c.date)}</strong>
        {c.median != null && <span className="chip minor">median ${Math.round(c.median)}</span>}
      </div>
      <table>
        <thead><tr><th>Hotel</th><th>Nightly rate</th></tr></thead>
        <tbody>
          {[...c.entries].sort((a, b) => a.price - b.price).map((e) => (
            <tr key={e.name}><td>{e.name}</td><td>${e.price}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompsetPanel({ compsets }: { compsets?: CompsetInfo[] }) {
  const list = (compsets ?? []).filter(Boolean);
  return (
    <section>
      <h2>Nearby competitors</h2>
      {list.length === 0 && (
        <p className="muted small">
          No competitor prices captured this run (harvested from Booking.com search results — if this persists, the whitelist in config/compset.json may need refreshing).
        </p>
      )}
      {list.map((c) => <Block key={c.date} c={c} />)}
      {list.length > 0 && (
        <p className="muted small">
          Tomorrow&apos;s median acts as a quiet-night sanity cap. Event-night prices are market intelligence only — they never cap the recommendation.
        </p>
      )}
    </section>
  );
}
