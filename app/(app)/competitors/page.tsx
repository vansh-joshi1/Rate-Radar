import { loadSnapshot } from '../../../lib/dashboard-data';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';
import WatchlistManager from '../../../components/WatchlistManager';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import type { CompsetInfo } from '../../../lib/scoring/types';

export const dynamic = 'force-dynamic';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

function CompsetTable({ c, ourPrice }: { c: CompsetInfo; ourPrice?: number }) {
  if (c.entries.length === 0) {
    return <p className="text-sm text-muted">No competitor prices captured for {fmt(c.date)} this run.</p>;
  }
  type Row = { name: string; price: number; kind: 'competitor' | 'us' | 'median' };
  const rows: Row[] = [
    ...c.entries.map((e): Row => ({ ...e, kind: 'competitor' })),
    ...(ourPrice != null ? [{ name: 'Red Roof Inn (you)', price: ourPrice, kind: 'us' } as Row] : []),
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
  const ourTonight = snapshot.nights[0]?.tiers.find((t) => t.tierId === 'standard')?.recommended;

  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Nearby competitors</SectionTitle>
        {isDemo && <SampleBadge />}
      </div>

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

      {compsets.map((c, i) => (
        <div key={c.date}>
          <h3 className="mb-3 font-serif text-xl font-bold">
            {i === 0 ? 'Tonight' : 'Future date'} — {fmt(c.date)}
          </h3>
          <CompsetTable c={c} ourPrice={i === 0 ? ourTonight : undefined} />
        </div>
      ))}

      <p className="text-xs text-muted">
        Compset is a sanity bound on quiet nights only — event nights are never capped. The whitelist lives in
        config/compset.json.
      </p>
    </div>
  );
}
