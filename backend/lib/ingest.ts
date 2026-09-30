import { todayIn, dateRange, dayOfWeek } from './date';
import { z } from 'zod';
import holidaysConfig from '../config/holidays.json';
import type { Store } from './store';
import { scoreEvent, nightScore } from './scoring/score';
import { recommendNight, upliftPct, confidence } from './scoring/recommend';
import { buildReasoning } from './scoring/reason';
import { evaluateAlerts, type HolidayEntry, type SourceHealth } from './alerts/rules';
import { sendAlertEmail } from './alerts/email';
import { matchCompset, compsetMedian, applyCompsetBound } from './scoring/compset';
import { DEFAULT_PROPERTY_ID, propKey, type Property } from './properties';
import { getStore } from './store';
import { ownersOf } from './auth/members';
import { HISTORY_KEPT } from './history';
import { accountFor } from './billing/accounts';
import { enforceCompCap } from './billing/limits';
import { loadWatchlist, saveWatchlist, watchlistKey, watchlistCompsetConfig, OPEN_PRICE_SANITY, type WatchlistHotel } from './watchlist';
import { loadRatesConfig } from './rates-config';
import type { RatesData } from '../collector/sources/rates';
import type {
  CompsetInfo, NightRecommendation, RawEvent, RateCheck, ScoredEvent, Snapshot, SourceResult, WeatherAlert,
} from './scoring/types';

/**
 * Parity is bought once a day, not once a run — see collector/budget.ts. A run
 * that did not buy it keeps showing the last measured set rather than blanking
 * the panel; every row carries its own `fetchedAt`, so the age stays visible.
 * Alerts deliberately still evaluate the run's own fresh parity, so a gap fires
 * when it is actually re-measured rather than re-fired against stale prices.
 */
export function carryForwardParity(fresh: RateCheck[], previous?: RateCheck[]): RateCheck[] {
  return fresh.length > 0 ? fresh : previous ?? [];
}

export const SourceResultSchema = z.object({
  source: z.string(),
  status: z.enum(['ok', 'failed', 'awaiting-key']),
  error: z.string().optional(),
  fetchedAt: z.string(),
  data: z.unknown().optional(),
});
export const BundleSchema = z.object({
  runAt: z.string(),
  /** Which hotel this bundle belongs to; defaults to the original property. */
  propertyId: z.string().optional(),
  sources: z.array(SourceResultSchema),
});
export type Bundle = z.infer<typeof BundleSchema>;

const WINDOW_NIGHTS = 22; // today + 21
const HOLIDAY_ATTENDANCE: Record<string, number> = { major: 40000, meaningful: 15000, minor: 6000 };

/**
 * Sources a property's market has, for confidence. The original property has
 * every Nashville source; a hotel added through onboarding has the ones that
 * work anywhere, plus airport status once an airport is set. Scoring a hotel
 * against sources its market cannot have would read as a permanent outage.
 */
export function expectedSources(property: Property): string[] | undefined {
  if (!property.collect) return undefined;
  return ['rates', 'ticketmaster', 'nws', 'holidays', ...(property.collect.airport ? ['faa'] : [])];
}

/**
 * @param store the property's own store (`storeFor`); everything written lands there.
 * @param property the hotel the bundle is for.
 */
export async function processBundle(bundle: Bundle, store: Store, now: Date, property: Property) {
  const bundlePropertyId = bundle.propertyId ?? DEFAULT_PROPERTY_ID;
  const today = todayIn(property.timezone, now);
  const window = dateRange(today, WINDOW_NIGHTS);
  const windowSet = new Set(window);

  // --- gather inputs from source results ---
  const src = (name: string) => bundle.sources.find((s) => s.source === name);
  const eventsRaw: RawEvent[] = [];
  for (const name of ['ticketmaster', 'cfbd', 'calendars']) {
    const s = src(name);
    if (s?.status === 'ok' && Array.isArray(s.data)) eventsRaw.push(...(s.data as RawEvent[]));
  }

  // Holiday pseudo-events + alert entries (synthesized locally — always available)
  const holidayEntries: HolidayEntry[] = [];
  for (const h of holidaysConfig.holidays) {
    const nightsInWindow = h.span.filter((d) => windowSet.has(d));
    if (nightsInWindow.length === 0) continue;
    holidayEntries.push({ name: h.name, date: h.date, drawProfile: h.drawProfile });
    for (const night of nightsInWindow) {
      eventsRaw.push({
        id: `holiday:${h.name}:${night}`,
        name: h.name,
        date: night,
        venue: 'regional travel',
        capacity: null,
        expectedAttendance: HOLIDAY_ATTENDANCE[h.drawProfile] ?? 6000,
        kind: 'holiday',
        source: 'holidays',
      });
    }
  }

  const weatherAlerts: WeatherAlert[] =
    src('nws')?.status === 'ok' && Array.isArray(src('nws')!.data)
      ? (src('nws')!.data as WeatherAlert[])
      : [];
  const faaData = src('faa')?.status === 'ok'
    ? (src('faa')!.data as { disrupted: boolean; airport: string; detail?: string })
    : null;

  const ratesData = src('rates')?.status === 'ok' ? (src('rates')!.data as RatesData | undefined) : undefined;
  const parity = ratesData?.checks ?? [];
  const rawCompsets = ratesData?.compsets ?? [];

  // Persist collector-resolved property tokens onto the watchlist so later runs
  // match those hotels exactly instead of by name substring.
  const resolvedTokens = ratesData?.resolvedPropertyTokens;
  if (resolvedTokens && Object.keys(resolvedTokens).length > 0) {
    const list = await loadWatchlist(store, bundlePropertyId);
    let changed = false;
    for (const hotel of list) {
      const token = resolvedTokens[hotel.name];
      if (token && hotel.propertyToken !== token) {
        hotel.propertyToken = token;
        changed = true;
      }
    }
    if (changed) await saveWatchlist(store, bundlePropertyId, list);
  }

  // Hold the list to the plan's cap before it bounds this run's compset. This is where
  // lists from before the caps, or a trim the token write above just undid, get cut.
  // Only a real ingest reaches here: a collector dry run never POSTs. A failed trim must
  // not fail the ingest, whether the account read or the trim fails; the next one tries again.
  try {
    await enforceCompCap(await accountFor(getStore(), bundlePropertyId, now), bundlePropertyId, store);
  } catch (err) {
    console.error(`[ingest] comp cap for ${bundlePropertyId} failed:`, err);
  }

  // Filter against the UI-editable watchlist when one exists (the collector
  // harvested with the same list); config/compset.json remains the fallback.
  const uiWatchlist = await store.get<WatchlistHotel[]>(watchlistKey(bundlePropertyId));
  const compsetCfg = uiWatchlist && uiWatchlist.length > 0 ? watchlistCompsetConfig(uiWatchlist, property.collect ? OPEN_PRICE_SANITY : undefined) : undefined;
  // Owner-editable baselines (Settings → Property); seeds from config/rates.json.
  const ratesCfg = await loadRatesConfig(store, bundlePropertyId);
  const compsets: CompsetInfo[] = rawCompsets.map((c) => {
    const entries = matchCompset(c.entries, compsetCfg);
    return { date: c.date, entries, median: compsetMedian(entries) };
  });
  const compsetByDate = new Map(compsets.map((c) => [c.date, c]));

  // --- score per night ---
  const byNight = new Map<string, ScoredEvent[]>();
  for (const e of eventsRaw) {
    if (!windowSet.has(e.date)) continue;
    const scored = scoreEvent(e);
    (byNight.get(e.date) ?? byNight.set(e.date, []).get(e.date)!).push(scored);
  }

  const severeWinterToday = weatherAlerts.some(
    (w) => w.isWinter && ['Severe', 'Extreme'].includes(w.severity)
  );

  const nights: NightRecommendation[] = window.map((date) => {
    const events = (byNight.get(date) ?? []).sort((a, b) => b.score - a.score);
    const ns = nightScore(events);
    const holidayName = events.find((e) => e.kind === 'holiday')?.name;
    const partial: Omit<NightRecommendation, 'reasoning'> = {
      date,
      dow: dayOfWeek(date),
      nightScore: ns,
      upliftPct: upliftPct(ns, ratesCfg),
      events,
      tiers: recommendNight(date, ns, ratesCfg),
      holidayName,
      weatherNote:
        date === today && severeWinterToday
          ? `Severe winter weather alert active — this can INCREASE short-notice demand (stranded ${property.id === DEFAULT_PROPERTY_ID ? 'I-65 ' : ''}travelers), not just suppress leisure travel. A modest same-night uplift may be warranted; treat as speculative.`
          : date === today && weatherAlerts.length > 0
            ? `Weather alert active: ${weatherAlerts[0].headline}. Watch for short-notice cancellations or demand.`
            : undefined,
      bnaNote:
        date === today && faaData?.disrupted
          ? `${faaData.airport} disruption: ${faaData.detail ?? 'delays/ground stop'} — mass disruption can spike last-minute overnight demand nearby.`
          : undefined,
    };
    // Compset applies per checked night: caps quiet nights, informs event nights
    const nightCompset = compsetByDate.get(date);
    if (nightCompset && nightCompset.median != null) {
      const bounded = applyCompsetBound(partial.tiers, ns, nightCompset.median);
      partial.tiers = bounded.tiers;
      const reasoning = buildReasoning(partial);
      if (bounded.note) reasoning.push(bounded.note);
      return { ...partial, reasoning };
    }
    return { ...partial, reasoning: buildReasoning(partial) };
  });

  // --- confidence (holidays source synthesized as always-ok) ---
  const sourcesForConfidence: SourceResult[] = [
    ...bundle.sources,
    { source: 'holidays', status: 'ok', fetchedAt: bundle.runAt },
  ];
  const conf = confidence(sourcesForConfidence, expectedSources(property));

  // --- alerting state ---
  const prevEmailed = (await store.get<Record<string, number>>('emailed:state')) ?? {};
  const fingerprints = (await store.get<Record<string, string>>('alert:fingerprints')) ?? {};
  const seenEventIds = (await store.get<string[]>('events:seen')) ?? [];
  // Scoped per property: parity checks share names (rate:expedia, …) across
  // hotels, and market sources arrive once per property bundle.
  const healthKey = `source:health:${bundlePropertyId}`;
  const sourceHealth = (await store.get<Record<string, SourceHealth>>(healthKey)) ?? {};

  const searchBudget = ratesData?.budget;

  // Parity costs a metered search, so only the first run of the day buys it.
  // Without this the 13:00 and 18:00 runs would overwrite the morning's parity
  // with nothing and blank the panel for two-thirds of the day.
  const prevSnapshot = await store.get<Snapshot>(propKey.snapshotLatest(bundlePropertyId));
  const parityToStore = carryForwardParity(parity, prevSnapshot?.parity);

  const alertResult = evaluateAlerts({
    nights, parity, weatherAlerts, holidays: holidayEntries,
    prevEmailed, fingerprints, seenEventIds, now: now.toISOString(),
    sources: bundle.sources, sourceHealth,
    ...(searchBudget ? { searchBudget } : {}),
  });

  // --- persist snapshot + state ---
  const runId = now.toISOString().replace(/[:.]/g, '-');
  const snapshot: Snapshot = {
    runAt: bundle.runAt, runId,
    confidence: conf.value, confidenceNote: conf.note,
    nights, parity: parityToStore,
    compsets,
    sources: bundle.sources,
  };
  // Property-scoped keys serve the v1 API; the unscoped keys are what the
  // dashboard reads. `store` is already this property's own (storeFor), so
  // writing the unscoped ones for every hotel keeps them apart.
  await store.set(propKey.snapshotLatest(bundlePropertyId), snapshot);
  // Raw bundle kept for /api/recompute: config edits (baselines, watchlist)
  // re-run scoring on the same data without waiting for the next scrape.
  await store.set(propKey.bundleLatest(bundlePropertyId), bundle);
  await store.set('snapshot:latest', snapshot);

  const todayNight = nights[0];
  const std = todayNight.tiers.find((t) => t.tierId === 'standard');
  const superior = todayNight.tiers.find((t) => t.tierId === 'superior');
  await store.hset('history', today, {
    date: today,
    recommendedStandard: std?.recommended ?? 0,
    recommendedSuperior: superior?.recommended ?? 0,
    nightScore: todayNight.nightScore,
    topDriver: todayNight.events[0]?.name ?? 'none',
    recordedAt: now.toISOString(),
    // Retained so Competitor Insights can plot our rate against the market
    // over time. Null when no competitor prices were collected this run —
    // recorded as a genuine gap rather than carrying the last value forward.
    compsetMedian: compsetByDate.get(today)?.median ?? null,
  });

  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  if (!historyDates.includes(today)) {
    const dates = [today, ...historyDates];
    await store.set('history:dates', dates.slice(0, HISTORY_KEPT));
    // Drop the records that fell off the list too, so the hash the Competitors page reads stays bounded.
    // Pruning is housekeeping: a failure must not fail the ingest.
    const dropped = dates.slice(HISTORY_KEPT);
    if (dropped.length > 0) await store.hdel('history', dropped).catch((err) => console.error('[ingest] history prune failed:', err));
  }

  // Send before recording alert state: a failed send must leave the triggers
  // un-delivered so the next run fires them again.
  let emailStatus: 'sent' | 'skipped' | 'none' | 'failed' = 'none';
  if (alertResult.triggers.length > 0) {
    // The original property mails ALERT_EMAIL_TO; an onboarded hotel mails its own owners.
    const to = property.collect
      ? await ownersOf(getStore(), property.id)
      : undefined;
    emailStatus = await sendAlertEmail(alertResult.triggers, to).catch((err) => {
      console.error('[ingest] alert email failed:', err);
      return 'failed' as const;
    });
  }
  if (emailStatus !== 'failed') {
    await store.set('emailed:state', alertResult.newEmailedState);
    await store.set('alert:fingerprints', alertResult.newFingerprints);
    await store.set('events:seen', alertResult.newSeenEventIds);
    await store.set(healthKey, alertResult.newSourceHealth);
  }

  return {
    nights: nights.length,
    eventsConsidered: eventsRaw.filter((e) => windowSet.has(e.date)).length,
    triggers: alertResult.triggers.map((t) => t.line),
    emailStatus,
    confidence: conf.value,
    failedSources: bundle.sources.filter((s) => s.status !== 'ok').map((s) => `${s.source} (${s.status})`),
  };
}
