import { collect as ticketmaster } from './sources/ticketmaster';
import { collect as cfbd } from './sources/cfbd';
import { collect as nws } from './sources/nws';
import { collect as faa } from './sources/faa';
import { collect as calendars } from './sources/calendars';
import { collect as rates } from './sources/rates';
import { loadProperties } from './properties';
import { pickCompsetDates } from './eventNights';
import { chicagoToday } from '../lib/ingest';
import type { RawEvent, SourceResult } from '../lib/scoring/types';

/**
 * Dumb collector: gather raw data from every source (isolated — one failing is
 * a warning, not a crash), POST one bundle PER PROPERTY to the Vercel ingest
 * endpoint where all scoring/diffing/alerting happens.
 *
 * Market sources (events/weather/airport) run once and are shared across
 * properties; the Playwright rate checks run per property, sequentially —
 * which also naturally staggers requests to the same booking sites.
 *
 * Flags:
 *   --dry-run     print the bundles instead of POSTing
 *   --skip-rates  skip the Playwright rate checks (fast local testing)
 */

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
  const properties = loadProperties();

  // Stage 1: market sources (parallel, once). Their events feed stage 2's date picks.
  const apiNames = ['ticketmaster', 'cfbd', 'nws', 'faa', 'calendars'];
  const settled = await Promise.allSettled([ticketmaster(), cfbd(), nws(), faa(), calendars()]);
  const marketSources: SourceResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          source: apiNames[i],
          status: 'failed' as const,
          fetchedAt: new Date().toISOString(),
          error: String(s.reason).slice(0, 300),
        }
  );

  const events: RawEvent[] = marketSources
    .filter((s) => ['ticketmaster', 'cfbd', 'calendars'].includes(s.source) && s.status === 'ok' && Array.isArray(s.data))
    .flatMap((s) => s.data as RawEvent[]);
  const eventNights = pickCompsetDates(events, chicagoToday());
  if (eventNights.length > 0) console.log(`[compset] event nights selected: ${eventNights.join(', ')}`);

  // Stage 2: per-property rate checks + one bundle per property.
  let anyOk = false;
  let anyIngestFailed = false;
  for (const prop of properties) {
    const sources: SourceResult[] = [...marketSources];
    if (!skipRates) {
      try {
        sources.push(await rates(eventNights, prop));
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
