import { z } from 'zod';
import holidaysConfig from '../config/holidays.json';
import type { Store } from './store';
import { scoreEvent, nightScore } from './scoring/score';
import { recommendNight, upliftPct, confidence } from './scoring/recommend';
import { buildReasoning } from './scoring/reason';
import { evaluateAlerts, type HolidayEntry, type SourceHealth } from './alerts/rules';
import { sendAlertEmail } from './alerts/email';
import { matchCompset, compsetMedian, applyCompsetBound } from './scoring/compset';
import { DEFAULT_PROPERTY_ID, propKey } from './properties';
import { loadWatchlist, saveWatchlist, watchlistKey, watchlistCompsetConfig, type WatchlistHotel } from './watchlist';
import { loadRatesConfig } from './rates-config';
import type {
  CompsetEntry, CompsetInfo, NightRecommendation, RawEvent, RateCheck, ScoredEvent, Snapshot, SourceResult, WeatherAlert,
} from './scoring/types';

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

/**
 * Rates-source payload has evolved; accept all three generations:
 *   v1: RateCheck[]
 *   v2: { checks, compset, compsetDate }  (single compset for tomorrow)
 *   v3: { checks, compsets: [{date, entries}] }  (tomorrow + event nights)
 */
export function parseRatesData(
  data: unknown,
  fallbackDate: string
): { parity: RateCheck[]; compsets: { date: string; entries: CompsetEntry[] }[] } {
  if (!data) return { parity: [], compsets: [] };
  if (Array.isArray(data)) return { parity: data as RateCheck[], compsets: [] };
  const obj = data as {
    checks?: RateCheck[];
    compsets?: { date: string; entries: CompsetEntry[] }[];
    compset?: CompsetEntry[];
    compsetDate?: string;
  };
  const parity = obj.checks ?? [];
  if (Array.isArray(obj.compsets)) return { parity, compsets: obj.compsets };
  if (Array.isArray(obj.compset)) {
    return { parity, compsets: [{ date: obj.compsetDate ?? fallbackDate, entries: obj.compset }] };
  }
  return { parity, compsets: [] };
}

const WINDOW_NIGHTS = 22; // today + 21
const HOLIDAY_ATTENDANCE: Record<string, number> = { major: 40000, meaningful: 15000, minor: 6000 };

export function chicagoToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function processBundle(bundle: Bundle, store: Store, now = new Date()) {
  const bundlePropertyId = bundle.propertyId ?? DEFAULT_PROPERTY_ID;
  const today = chicagoToday(now);
  const window = Array.from({ length: WINDOW_NIGHTS }, (_, i) => addDays(today, i));
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
  const faaData = src('faa')?.status === 'ok' ? (src('faa')!.data as { bnaDisrupted: boolean; detail?: string }) : null;

  const ratesData = src('rates')?.status === 'ok' ? src('rates')!.data : null;
  const { parity, compsets: rawCompsets } = parseRatesData(ratesData, addDays(chicagoToday(now), 1));

  // Persist collector-resolved Booking URLs onto the watchlist so future runs
  // price those hotels directly without re-resolving.
  const resolvedUrls = (ratesData as { resolvedBookingUrls?: Record<string, string> } | null)?.resolvedBookingUrls;
  if (resolvedUrls && Object.keys(resolvedUrls).length > 0) {
    const list = await loadWatchlist(store, bundlePropertyId);
    let changed = false;
    for (const hotel of list) {
      const url = resolvedUrls[hotel.name];
      if (url && !hotel.bookingUrl) {
        hotel.bookingUrl = url;
        changed = true;
      }
    }
    if (changed) await saveWatchlist(store, bundlePropertyId, list);
  }
  // Filter against the UI-editable watchlist when one exists (the collector
  // harvested with the same list); config/compset.json remains the fallback.
  const uiWatchlist = await store.get<WatchlistHotel[]>(watchlistKey(bundlePropertyId));
  const compsetCfg = uiWatchlist && uiWatchlist.length > 0 ? watchlistCompsetConfig(uiWatchlist) : undefined;
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
      dow: new Date(`${date}T12:00:00Z`).getUTCDay(),
      nightScore: ns,
      upliftPct: upliftPct(ns, ratesCfg),
      events,
      tiers: recommendNight(date, ns, ratesCfg),
      holidayName,
      weatherNote:
        date === today && severeWinterToday
          ? 'Severe winter weather alert active — this can INCREASE short-notice demand (stranded I-65 travelers), not just suppress leisure travel. A modest same-night uplift may be warranted; treat as speculative.'
          : date === today && weatherAlerts.length > 0
            ? `Weather alert active: ${weatherAlerts[0].headline}. Watch for short-notice cancellations or demand.`
            : undefined,
      bnaNote:
        date === today && faaData?.bnaDisrupted
          ? `BNA disruption: ${faaData.detail ?? 'delays/ground stop'} — mass disruption can spike last-minute overnight demand nearby.`
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
  const conf = confidence(sourcesForConfidence);

  // --- alerting state ---
  const prevEmailed = (await store.get<Record<string, number>>('emailed:state')) ?? {};
  const fingerprints = (await store.get<Record<string, string>>('alert:fingerprints')) ?? {};
  const seenEventIds = (await store.get<string[]>('events:seen')) ?? [];
  // Scoped per property: parity checks share names (rate:expedia, …) across
  // hotels, and market sources arrive once per property bundle.
  const healthKey = `source:health:${bundlePropertyId}`;
  const sourceHealth = (await store.get<Record<string, SourceHealth>>(healthKey)) ?? {};

  const alertResult = evaluateAlerts({
    nights, parity, weatherAlerts, holidays: holidayEntries,
    prevEmailed, fingerprints, seenEventIds, now: now.toISOString(),
    sources: bundle.sources, sourceHealth,
  });

  // --- persist snapshot + state ---
  const runId = now.toISOString().replace(/[:.]/g, '-');
  const snapshot: Snapshot = {
    runAt: bundle.runAt, runId,
    confidence: conf.value, confidenceNote: conf.note,
    nights, parity,
    compset: compsets[0], // back-compat for older readers
    compsets,
    sources: bundle.sources,
  };
  // Property-scoped keys are the durable layout (multi-hotel ready); the
  // legacy unscoped keys are dual-written for the default property so the
  // existing dashboard and older readers keep working unchanged.
  await store.set(propKey.snapshotLatest(bundlePropertyId), snapshot);
  await store.set(propKey.snapshotRun(bundlePropertyId, today, runId), snapshot, 30 * 86400);
  // Raw bundle kept for /api/recompute: config edits (baselines, watchlist)
  // re-run scoring on the same data without waiting for the next scrape.
  await store.set(`prop:${bundlePropertyId}:bundle:latest`, bundle);
  if (bundlePropertyId === DEFAULT_PROPERTY_ID) {
    await store.set('snapshot:latest', snapshot);
    await store.set(`snapshot:${today}:${runId}`, snapshot, 30 * 86400);
  }

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
  });

  const historyDates = (await store.get<string[]>('history:dates')) ?? [];
  if (!historyDates.includes(today)) {
    await store.set('history:dates', [today, ...historyDates].slice(0, 400));
  }

  await store.set('emailed:state', alertResult.newEmailedState);
  await store.set('alert:fingerprints', alertResult.newFingerprints);
  await store.set('events:seen', alertResult.newSeenEventIds);
  await store.set(healthKey, alertResult.newSourceHealth);

  let emailStatus: 'sent' | 'skipped' | 'none' = 'none';
  if (alertResult.triggers.length > 0) emailStatus = await sendAlertEmail(alertResult.triggers);

  return {
    nights: nights.length,
    eventsConsidered: eventsRaw.filter((e) => windowSet.has(e.date)).length,
    triggers: alertResult.triggers.map((t) => t.line),
    emailStatus,
    confidence: conf.value,
    failedSources: bundle.sources.filter((s) => s.status !== 'ok').map((s) => `${s.source} (${s.status})`),
  };
}
