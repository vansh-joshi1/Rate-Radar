import { collect as ticketmaster } from './sources/ticketmaster';
import { collect as cfbd } from './sources/cfbd';
import { collect as nws } from './sources/nws';
import { collect as faa } from './sources/faa';
import { collect as calendars } from './sources/calendars';
import { collect as rates } from './sources/rates';
import { fromStoredProperty, loadProperties, type Market, type RatePropertyConfig } from './properties';
import type { Property } from '../lib/properties';
import type { SourceResult } from '../lib/scoring/types';

/**
 * Dumb collector: gather raw data from every source (isolated — one failing is
 * a warning, not a crash), POST one bundle PER PROPERTY to the Vercel ingest
 * endpoint where all scoring/diffing/alerting happens.
 *
 * Market sources (events/weather/airport) run once and are shared across
 * properties; the SerpApi price fetches run per property, sequentially, each
 * drawing from the same monthly search budget (see collector/budget.ts).
 *
 * Flags:
 *   --dry-run     print the bundles instead of POSTing
 *   --skip-rates  skip the price fetches (fast local testing, spends no searches)
 */

/**
 * The UI-editable watchlist lives in the dashboard's store; fetch it so edits
 * take effect on the next run without a deploy. Any failure (local dev, URL
 * unset, endpoint down) falls back to the config-file whitelist — a stale
 * compset beats no compset.
 */
async function fetchWatchlist(propertyId: string): Promise<{ name: string; propertyToken?: string }[] | null> {
  const base = process.env.DASHBOARD_URL;
  const secret = process.env.INGEST_SECRET;
  if (!base || !secret) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/watchlist?propertyId=${encodeURIComponent(propertyId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;
    const { hotels } = (await res.json()) as { hotels: { name: string; propertyToken?: string }[] };
    return hotels.length > 0 ? hotels : null;
  } catch {
    return null;
  }
}

/**
 * Hotels approved from onboarding live in the dashboard's store, so a new one
 * is collected on the next run without a deploy. Unreachable dashboard →
 * collect the config-file property alone rather than nothing.
 */
async function fetchStoredProperties(): Promise<RatePropertyConfig[]> {
  const base = process.env.DASHBOARD_URL;
  const secret = process.env.INGEST_SECRET;
  if (!base || !secret) return [];
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/ingest/properties`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { properties } = (await res.json()) as { properties: Property[] };
    return properties.filter(hasCollect).map(fromStoredProperty);
  } catch (err) {
    console.error('[properties] could not fetch onboarded hotels, collecting config-file properties only:', err);
    return [];
  }
}

const hasCollect = (p: Property): p is Property & { collect: NonNullable<Property['collect']> } => Boolean(p.collect);

/** Run sources in parallel; a throw becomes that source's 'failed' result, never the run's. */
async function settleAll(runs: Record<string, Promise<SourceResult>>): Promise<SourceResult[]> {
  const names = Object.keys(runs);
  const settled = await Promise.allSettled(Object.values(runs));
  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { source: names[i], status: 'failed' as const, fetchedAt: new Date().toISOString(), error: String(s.reason).slice(0, 300) }
  );
}

async function postBundle(bundle: unknown): Promise<unknown> {
  const base = process.env.DASHBOARD_URL;
  const secret = process.env.INGEST_SECRET;
  if (!base || !secret) throw new Error('DASHBOARD_URL / INGEST_SECRET unset');
  const res = await fetch(`${base.replace(/\/$/, '')}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify(bundle),
  });
  const summary = await res.json();
  if (!res.ok) throw new Error(`Ingest rejected (${res.status}): ${JSON.stringify(summary)}`);
  return summary;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const skipRates = process.argv.includes('--skip-rates');
  const properties = [...loadProperties(), ...(await fetchStoredProperties())];

  // Stage 1: market sources. All free APIs. The Nashville set is fetched once
  // and shared; any other hotel gets its own, by location (see Market).
  let nashville: Promise<SourceResult[]> | null = null;
  const marketSources = (market: Market): Promise<SourceResult[]> => {
    if (market.kind === 'nashville') {
      return (nashville ??= settleAll({ ticketmaster: ticketmaster(), cfbd: cfbd(), nws: nws(), faa: faa(), calendars: calendars() }));
    }
    const point = { lat: market.lat, lng: market.lng };
    return settleAll({
      ticketmaster: ticketmaster(point),
      nws: nws(point),
      ...(market.airport ? { faa: faa(market.airport) } : {}),
    });
  };

  // Stage 2: per-property rate checks + one bundle per property.
  let anyOk = false;
  let anyIngestFailed = false;
  for (const prop of properties) {
    const sources: SourceResult[] = [...(await marketSources(prop.market))];
    if (!skipRates) {
      const liveWatchlist = await fetchWatchlist(prop.id);
      if (liveWatchlist) {
        const withTokens = liveWatchlist.filter((h) => h.propertyToken).length;
        console.log(`[watchlist] ${prop.id}: ${liveWatchlist.length} hotels from the dashboard (${withTokens} with resolved property tokens)`);
        prop.compset = { ...prop.compset, competitors: liveWatchlist.map((h) => h.name) };
        prop.watchlistHotels = liveWatchlist;
      }
      try {
        sources.push(await rates(prop, { share: properties.length }));
      } catch (err) {
        sources.push({
          source: 'rates',
          status: 'failed',
          fetchedAt: new Date().toISOString(),
          error: String(err).slice(0, 300),
        });
      }
    }

    console.log(`\n=== Collection summary — ${prop.name} (${prop.id}) ===`);
    for (const s of sources) {
      const count = Array.isArray(s.data) ? ` (${s.data.length} items)` : '';
      console.log(`  ${s.status === 'ok' ? '✓' : '✗'} ${s.source}: ${s.status}${count}${s.error ? ` — ${s.error.slice(0, 140)}` : ''}`);
    }
    if (sources.some((s) => s.status === 'ok')) anyOk = true;

    const bundle = { runAt: new Date().toISOString(), propertyId: prop.id, sources };
    if (dryRun) {
      console.log(`\n[dry-run] bundle for ${prop.id}:`);
      console.log(JSON.stringify(bundle, null, 2));
      continue;
    }
    try {
      const summary = await postBundle(bundle);
      console.log(`\n=== Ingest summary — ${prop.id} ===`);
      console.log(JSON.stringify(summary, null, 2));
    } catch (err) {
      // One property's ingest failure must not stop the others.
      anyIngestFailed = true;
      console.error(`Ingest failed for ${prop.id}:`, err);
    }
  }

  if (!anyOk) {
    console.error('ALL sources failed — treating run as failed.');
    process.exit(1);
  }
  if (anyIngestFailed && !dryRun) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
