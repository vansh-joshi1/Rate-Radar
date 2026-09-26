import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { loadSnapshot } from '../../../../backend/lib/dashboard-data';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { loadCurrentRates } from '../../../../backend/lib/current-rates';
import { loadWatchlist } from '../../../../backend/lib/watchlist';
import ParityGrid from '../../../components/ParityGrid';
import { trackedParity } from '../../../../backend/lib/parity/channels';
import CompetitorInsights, {
  type CompsetNight,
  type HistoryPoint,
} from '../../../components/CompetitorInsights';
import type { HistoryRecord } from '../../../../backend/lib/scoring/types';

export const dynamic = 'force-dynamic';

export default async function Competitors() {
  const { snapshot, isDemo } = await loadSnapshot();
  const store = await requestStore();
  const property = await requestProperty();

  const compsets = (snapshot.compsets ?? (snapshot.compset ? [snapshot.compset] : [])).filter(Boolean);

  // Your rate: owner-entered (authoritative — you set your prices) beats the
  // scraped direct rate, which redroof.com's bot wall often blocks anyway.
  const ownerRates = await loadCurrentRates(store, property.id);
  const ownerStandard = ownerRates?.tiers['standard'];
  const scrapedDirect = snapshot.parity.find((p) => p.official && p.status === 'ok' && p.price != null)?.price;
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
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist text-[#1a1b20] antialiased`}>
      <CompetitorInsights
        propertyId={property.id}
        propertyName={property.name}
        nights={nights}
        history={history}
        yourRate={yourRate?.price ?? null}
        initialWatchlist={watchlist.map((h) => h.name)}
        isDemo={isDemo}
        /*
          Parity sits beside the price history because it answers the
          neighbouring question: not "what are others charging" but "what are
          others charging for MY rooms". Passed in only when a channel is
          tracked, so the history panel can take the full row otherwise.
        */
        parity={trackedParity(snapshot.parity).length > 0 ? <ParityGrid parity={snapshot.parity} /> : null}
      />
    </div>
  );
}
