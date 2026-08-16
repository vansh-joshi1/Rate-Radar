import { loadSnapshot } from '../../../lib/dashboard-data';
import { getStore } from '../../../lib/store';
import { loadCurrentRates } from '../../../lib/current-rates';
import { loadWatchlist } from '../../../lib/watchlist';
import { chicagoToday } from '../../../lib/ingest';
import { SampleBadge } from '../../../components/ui';
import CompetitorInsights, {
  type CompsetNight,
  type HistoryPoint,
} from '../../../components/CompetitorInsights';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { DEFAULT_RATES_CONFIG } from '../../../lib/rates-config';
import type { HistoryRecord } from '../../../lib/scoring/types';

export const dynamic = 'force-dynamic';

export default async function Competitors() {
  const { snapshot, isDemo } = await loadSnapshot();
  const store = getStore();
  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  const compsets = (snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : [])).filter(Boolean);

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

  // Recorded history — one point per collector run. The chart plots the window
  // that actually exists rather than padding out to a fixed 90 days.
  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  const history: HistoryPoint[] = [];
  for (const d of historyDates.slice(0, 90)) {
    const rec = await store.hget<HistoryRecord>('history', d);
    if (rec) {
      history.push({
        date: rec.date,
        recommended: rec.recommendedStandard,
        compsetMedian: rec.compsetMedian ?? null,
      });
    }
  }

  // Our recommended standard rate per night, keyed for the heatmap's own row.
  const recommendedByDate = new Map(
    snapshot.nights.map((n) => [
      n.date,
      (n.tiers.find((t) => t.tierId === 'standard') ?? n.tiers[0]).recommended,
    ]),
  );
  const nights: CompsetNight[] = compsets.map((c) => ({
    date: c.date,
    entries: c.entries,
    median: c.median,
    recommended: recommendedByDate.get(c.date) ?? 0,
  }));

  return (
    <div>
      {isDemo && (
        <div className="mb-md flex justify-end">
          <SampleBadge />
        </div>
      )}

      <CompetitorInsights
        propertyId={property.id}
        propertyName={property.name}
        nights={nights}
        history={history}
        yourRate={yourRate?.price ?? null}
        tiers={DEFAULT_RATES_CONFIG.tiers.map((t) => ({ tierId: t.id, label: t.label }))}
        compSetName={watchlist.length > 0 ? `Watchlist (${watchlist.length} hotels)` : 'Default comp set'}
        initialWatchlist={watchlist.map((h) => h.name)}
      />
    </div>
  );
}
