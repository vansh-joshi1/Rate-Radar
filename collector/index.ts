import { collect as ticketmaster } from './sources/ticketmaster';
import { collect as cfbd } from './sources/cfbd';
import { collect as nws } from './sources/nws';
import { collect as faa } from './sources/faa';
import { collect as calendars } from './sources/calendars';
import { collect as rates } from './sources/rates';
import { pickCompsetDates } from './eventNights';
import { chicagoToday } from '../lib/ingest';
import type { RawEvent, SourceResult } from '../lib/scoring/types';

/**
 * Dumb collector: gather raw data from every source (isolated — one failing is
 * a warning, not a crash), POST the bundle to the Vercel ingest endpoint where
 * all scoring/diffing/alerting happens.
 *
 * Flags:
 *   --dry-run     print the bundle instead of POSTing
 *   --skip-rates  skip the Playwright rate checks (fast local testing)
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const skipRates = process.argv.includes('--skip-rates');

  // Stage 1: API collectors (parallel). Their events feed stage 2's date picks.
  const apiNames = ['ticketmaster', 'cfbd', 'nws', 'faa', 'calendars'];
  const settled = await Promise.allSettled([ticketmaster(), cfbd(), nws(), faa(), calendars()]);
  const sources: SourceResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          source: apiNames[i],
          status: 'failed' as const,
          fetchedAt: new Date().toISOString(),
          error: String(s.reason).slice(0, 300),
        }
  );

  // Stage 2: Playwright rate checks + compset — tomorrow always, plus event
  // nights scoring >= 40 (computed in-process from stage 1's events).
  if (!skipRates) {
    const events: RawEvent[] = sources
      .filter((s) => ['ticketmaster', 'cfbd', 'calendars'].includes(s.source) && s.status === 'ok' && Array.isArray(s.data))
      .flatMap((s) => s.data as RawEvent[]);
    const eventNights = pickCompsetDates(events, chicagoToday());
    if (eventNights.length > 0) console.log(`[compset] event nights selected: ${eventNights.join(', ')}`);
    try {
      sources.push(await rates(eventNights));
    } catch (err) {
      sources.push({
        source: 'rates',
        status: 'failed',
        fetchedAt: new Date().toISOString(),
        error: String(err).slice(0, 300),
      });
    }
  }

  console.log('\n=== Collection summary ===');
  for (const s of sources) {
    const count = Array.isArray(s.data) ? ` (${s.data.length} items)` : '';
    console.log(`  ${s.status === 'ok' ? '✓' : '✗'} ${s.source}: ${s.status}${count}${s.error ? ` — ${s.error.slice(0, 140)}` : ''}`);
  }

  const bundle = { runAt: new Date().toISOString(), sources };

  if (dryRun) {
    console.log('\n[dry-run] bundle:');
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

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

  console.log('\n=== Ingest summary ===');
  console.log(JSON.stringify(summary, null, 2));

  const allFailed = sources.every((s) => s.status !== 'ok');
  if (allFailed) {
    console.error('ALL sources failed — treating run as failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
