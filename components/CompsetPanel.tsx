import type { CompsetInfo } from '../lib/scoring/types';

export default function CompsetPanel({ compset }: { compset?: CompsetInfo }) {
  if (!compset || compset.entries.length === 0) {
    return (
      <section>
        <h2>Nearby competitors</h2>
        <p className="muted small">
          No competitor prices captured this run (harvested from the Google Hotels page — if this persists, the whitelist in config/compset.json may need refreshing).
        </p>
      </section>
    );
  }
  return (
    <section>
      <h2>
        Nearby competitors — {compset.date}{' '}
        {compset.median != null && <span className="chip minor">median ${compset.median}</span>}
      </h2>
      <table>
        <thead><tr><th>Hotel</th><th>Nightly rate</th></tr></thead>
        <tbody>
          {[...compset.entries].sort((a, b) => a.price - b.price).map((c) => (
            <tr key={c.name}><td>{c.name}</td><td>${c.price}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ marginTop: 10 }}>
        Compset is a sanity bound, not a driver: quiet nights get capped near market; event nights are never capped.
      </p>
    </section>
  );
}
