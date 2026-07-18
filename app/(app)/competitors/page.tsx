import { loadSnapshot } from '../../../lib/dashboard-data';
import { chicagoToday } from '../../../lib/ingest';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';
import WatchlistManager from '../../../components/WatchlistManager';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import type { CompsetInfo } from '../../../lib/scoring/types';

export const dynamic = 'force-dynamic';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function CompsetTable({ c, ourPrice, ourLabel }: { c: CompsetInfo; ourPrice?: number; ourLabel?: string }) {
  if (c.entries.length === 0) {
    return <p className="text-sm text-muted">No competitor prices captured for {fmt(c.date)} this run.</p>;
  }
  type Row = { name: string; price: number; kind: 'competitor' | 'us' | 'median' };
  const rows: Row[] = [
    ...c.entries.map((e): Row => ({ ...e, kind: 'competitor' })),
    ...(ourPrice != null ? [{ name: ourLabel ?? 'You', price: ourPrice, kind: 'us' } as Row] : []),
    ...(c.median != null ? [{ name: 'Compset median', price: c.median, kind: 'median' } as Row] : []),
  ].sort((a, b) => a.price - b.price);

  return (
    <div className="card mb-6 p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr><th className="th">Hotel</th><th className="th">Nightly rate</th><th className="th" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.name}
                className={
                  r.kind === 'us'
                    ? 'bg-accent/5 font-semibold [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent'
                    : r.kind === 'median'
                      ? 'bg-ink/[0.04] font-bold uppercase'
                      : 'hover:bg-ink/[0.03]'
                }
              >
                <td className="td">{r.name}</td>
                <td className={`td font-serif text-lg ${r.kind === 'us' ? 'text-accent' : ''}`}>
                  ${Math.round(r.price)}
                </td>
                <td className="td text-right">
                  {r.kind === 'us' && <Chip tone="bad">You</Chip>}
                  {r.kind === 'median' && <Chip>Median</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function Competitors() {
  const { snapshot, isDemo } = await loadSnapshot();
  const compsets = (snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : [])).filter(Boolean);
  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  const today = chicagoToday();
  const tomorrow = addDays(today, 1);
  // Parity checks price tomorrow night — our actual listed rate applies to that date only.
  const directListed = snapshot.parity.find((p) => p.source === 'redroof' && p.status === 'ok' && p.price != null)?.price;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Nearby competitors</SectionTitle>
        {isDemo && <SampleBadge />}
      </div>

      {(() => {
        // Market position: your lead (cheapest public) rate vs the compset —
        // lead-vs-lead is the honest cross-hotel comparison; room-level
        // matching across brands compares different products.
        const block = compsets.find((c) => c.date === tomorrow) ?? compsets[0];
        if (!block || block.entries.length === 0 || directListed == null) return null;
        const cheaper = block.entries.filter((e) => e.price < directListed).length;
        const vsMedian = block.median ? Math.round(((directListed - block.median) / block.median) * 100) : null;
        return (
          <div className="card mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">Your lead rate ({fmt(block.date)})</div>
              <div className="font-serif text-3xl font-semibold text-accent">${directListed}</div>
            </div>
            <div className="text-sm">
              <span className="font-semibold">#{cheaper + 1} cheapest</span> of {block.entries.length + 1} tracked hotels
              {vsMedian != null && (
                <span className="text-muted"> · {vsMedian === 0 ? 'at' : `${Math.abs(vsMedian)}% ${vsMedian > 0 ? 'above' : 'below'}`} compset median (${Math.round(block.median!)})</span>
              )}
            </div>
          </div>
        );
      })()}

      <WatchlistManager
        propertyId={property.id}
        property={{ name: property.name, lat: property.lat, lng: property.lng }}
        compsetEntries={compsets[0]?.entries ?? []}
      />

      {compsets.length === 0 && (
        <p className="text-sm text-muted">
          No competitor prices captured this run (harvested from Booking.com search results — if this persists, the
          whitelist in config/compset.json may need refreshing).
        </p>
      )}

      {compsets.map((c) => {
        // Compare like with like: our row for a night uses that night's data —
        // the scraped direct rate for tomorrow (what parity actually checked),
        // otherwise that night's recommendation, clearly labeled as such.
        const heading = c.date === today ? 'Tonight' : c.date === tomorrow ? 'Tomorrow' : 'Event night';
        const nightRec = snapshot.nights.find((n) => n.date === c.date)?.tiers.find((t) => t.tierId === 'standard')?.recommended;
        const useListed = c.date === tomorrow && directListed != null;
        const ourPrice = useListed ? directListed : nightRec;
        const ourLabel = useListed
          ? `${property.name} (you — listed on redroof.com)`
          : `${property.name} (you — recommended)`;
        return (
          <div key={c.date}>
            <h3 className="mb-3 text-lg font-bold tracking-tight">
              {heading} — {fmt(c.date)}
            </h3>
            <CompsetTable c={c} ourPrice={ourPrice} ourLabel={ourLabel} />
          </div>
        );
      })}

      <p className="text-xs text-muted">
        Compset is a sanity bound on quiet nights only — event nights are never capped. The whitelist lives in
        config/compset.json.
      </p>
    </div>
  );
}
