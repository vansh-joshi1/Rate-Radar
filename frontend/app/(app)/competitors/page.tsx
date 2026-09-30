import { loadSnapshot } from '../../../../backend/lib/dashboard-data';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { loadCurrentRates } from '../../../../backend/lib/current-rates';
import { loadWatchlist, trimNoteKey, type TrimNote } from '../../../../backend/lib/watchlist';
import { limitsForProperty } from '../../../../backend/lib/billing/limits';
import { addDays, todayIn } from '../../../../backend/lib/date';
import ParityGrid from '../../../components/ParityGrid';
import { trackedParity } from '../../../../backend/lib/parity/channels';
import CompetitorInsights, {
  type CompsetNight,
  type HistoryPoint,
} from '../../../components/CompetitorInsights';
import { recentHistory } from '../../../../backend/lib/history';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Competitor insights' };

export default async function Competitors() {
  const { snapshot, isDemo } = await loadSnapshot();
  const store = await requestStore();
  const property = await requestProperty();

  const compsets = snapshot.compsets ?? [];

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

  // History as far back as the plan shows.
  const limits = await limitsForProperty(property.id);
  const since = addDays(todayIn(property.timezone), -limits.historyDays);
  const history: HistoryPoint[] = (await recentHistory(store, since)).map((rec) => ({
    date: rec.date,
    recommended: rec.recommendedStandard,
    compsetMedian: rec.compsetMedian ?? null,
  }));
  // A note from another cap is stale.
  const note = await store.get<TrimNote>(trimNoteKey(property.id));
  const trimNote = note?.max === limits.maxComps ? note : null;

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
    <div className="font-geist text-[#1a1b20] antialiased">
      <CompetitorInsights
        propertyId={property.id}
        propertyName={property.name}
        nights={nights}
        history={history}
        yourRate={yourRate?.price ?? null}
        initialWatchlist={watchlist.map((h) => h.name)}
        maxComps={limits.maxComps}
        trimNote={trimNote}
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
