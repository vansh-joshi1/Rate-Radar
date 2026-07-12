import { collect as ticketmaster } from './sources/ticketmaster';
import { collect as cfbd } from './sources/cfbd';
import { collect as nws } from './sources/nws';
import { collect as faa } from './sources/faa';
import { collect as calendars } from './sources/calendars';
import { collect as rates } from './sources/rates';
import type { SourceResult } from '../lib/scoring/types';

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

  const collectors: (() => Promise<SourceResult>)[] = [
    ticketmaster, cfbd, nws, faa, calendars,
    ...(skipRates ? [] : [rates]),
  ];

  const settled = await Promise.allSettled(collectors.map((c) => c()));
  const sources: SourceResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          source: ['ticketmaster', 'cfbd', 'nws', 'faa', 'calendars', 'rates'][i],
          status: 'failed' as const,
          fetchedAt: new Date().toISOString(),
          error: String(s.reason).slice(0, 300),
        }
  );

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
