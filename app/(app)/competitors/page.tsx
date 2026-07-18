import { loadSnapshot } from '../../../lib/dashboard-data';
import { getStore } from '../../../lib/store';
import { loadCurrentRates } from '../../../lib/current-rates';
import { loadWatchlist } from '../../../lib/watchlist';
import { chicagoToday } from '../../../lib/ingest';
import { SampleBadge, SectionTitle } from '../../../components/ui';
import CompsetExplorer, { type ExplorerBlock } from '../../../components/CompsetExplorer';
import WatchlistManager from '../../../components/WatchlistManager';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';

export const dynamic = 'force-dynamic';

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const sublabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

export default async function Competitors() {
  const { snapshot, isDemo } = await loadSnapshot();
  const store = getStore();
  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  const today = chicagoToday();
  const tomorrow = addDays(today, 1);

  // Night tabs exist only for nights we actually collected prices for.
  const compsets = (snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : [])).filter(Boolean);
  const blocks: ExplorerBlock[] = compsets.map((c) => ({
    date: c.date,
    label:
      c.date === today
        ? 'Tonight'
        : c.date === tomorrow
          ? 'Tomorrow'
          : new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    sublabel: sublabel(c.date),
    entries: c.entries,
  }));

  // Your rate: owner-entered (authoritative — you set your prices) beats the
  // scraped direct rate, which redroof.com's bot wall often blocks anyway.
  const ownerRates = isDemo ? null : await loadCurrentRates(store, property.id);
  const ownerStandard = ownerRates?.tiers['standard'];
  const scrapedDirect = snapshot.parity.find((p) => p.source === 'redroof' && p.status === 'ok' && p.price != null)?.price;
  const yourRate =
    ownerStandard != null
      ? { price: ownerStandard, source: 'owner' as const }
      : scrapedDirect != null
        ? { price: scrapedDirect, source: 'scrape' as const }
        : null;

  const watchlist = (await loadWatchlist(store, property.id)).map((h) => ({
    name: h.name,
    lat: h.lat,
    lng: h.lng,
    address: h.address,
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle>Nearby competitors</SectionTitle>
        {isDemo && <SampleBadge />}
      </div>

      {blocks.length > 0 ? (
        <CompsetExplorer
          property={{ name: property.name, lat: property.lat, lng: property.lng }}
          yourRate={yourRate}
          blocks={blocks}
          watchlist={watchlist}
        />
      ) : (
        <p className="mb-6 text-sm text-muted">
          No competitor prices captured yet — they appear after the next collection run.
        </p>
      )}

      <WatchlistManager propertyId={property.id} />

      <p className="mt-4 text-xs text-muted">
        Compset is a sanity bound on quiet nights only — event nights are never capped.
      </p>
    </div>
  );
}
