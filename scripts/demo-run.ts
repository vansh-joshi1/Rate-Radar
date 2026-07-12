/**
 * Demo run — 2026-07-12 — REAL data, gathered live, pushed through the REAL
 * scoring/alerting pipeline (lib/ingest.processBundle) against a local FileStore.
 *
 * Provenance of every source (the sandbox blocks direct API egress, so data was
 * gathered via the assistant's fetch tool and the user's own browser, then fed
 * through the exact same code path the GitHub Action uses):
 *  - ticketmaster: Discovery API queried live with the real key, by venueId,
 *    all 3 venues, window Jul 12–Aug 2. Junk (dinner/VIP/parking) filtered,
 *    duplicates deduped — exactly what collector/sources/ticketmaster.ts emits.
 *  - cfbd: NOT reachable from the demo environment (requires an Authorization
 *    header the fetch tool can't send). Marked failed — honest degradation.
 *  - nws: api.weather.gov queried live in the user's browser.
 *  - faa: nasstatus.faa.gov queried live in the user's browser.
 *  - calendars: Vanderbilt page fetched live (Commencement 2027-05-14 — outside
 *    the 22-night window, so 0 events contribute). Belmont page returned an
 *    empty shell to plain fetch → warned & skipped. MCC (nashvillemcc.com)
 *    fetched live with published attendance figures.
 *  - rates: all four sources checked live in the user's browser for Jul 13→14.
 */
import { processBundle, type Bundle } from '../lib/ingest';
import { FileStore } from '../lib/store';
import type { RawEvent, RateCheck, WeatherAlert } from '../lib/scoring/types';

const NOW = new Date('2026-07-12T15:30:00-05:00');
const AT = NOW.toISOString();

const tm = (e: Omit<RawEvent, 'source'>): RawEvent => ({ ...e, source: 'ticketmaster' });
const tmEvents: RawEvent[] = [
  tm({ id: 'tm:Z7r9jZ1A7OE0x', name: 'DCI: Drum Corps International', date: '2026-07-24', venue: 'Nissan Stadium', capacity: 69000, expectedAttendance: 24150, kind: 'concert', isTouring: true, selloutLikely: true }),
  tm({ id: 'tm:G5viZ_FB9jaUj', name: 'The R&B Tour - Starring Usher Raymond & Chris Brown', date: '2026-07-25', venue: 'Nissan Stadium', capacity: 69000, kind: 'concert', isTouring: true, selloutLikely: true }),
  tm({ id: 'tm:hotwheels-0718', name: 'Hot Wheels Monster Trucks Live Glow-N-Fire', date: '2026-07-18', venue: 'Bridgestone Arena', capacity: 17100, kind: 'sports', multiNight: true, selloutLikely: true }),
  tm({ id: 'tm:hotwheels-0719', name: 'Hot Wheels Monster Trucks Live Glow-N-Fire', date: '2026-07-19', venue: 'Bridgestone Arena', capacity: 17100, kind: 'sports', multiNight: true, selloutLikely: true }),
  tm({ id: 'tm:trainor-0724', name: 'Meghan Trainor: The Get In Girl Tour', date: '2026-07-24', venue: 'Bridgestone Arena', capacity: 17100, kind: 'concert', isTouring: true }),
  tm({ id: 'tm:zayn-0731', name: 'ZAYN: The Konnakol Tour', date: '2026-07-31', venue: 'Bridgestone Arena', capacity: 17100, kind: 'concert', isTouring: true }),
  tm({ id: 'tm:manilow-0801', name: 'MANILOW: The Last Nashville Concert', date: '2026-08-01', venue: 'Bridgestone Arena', capacity: 17100, kind: 'concert', isTouring: true }),
  tm({ id: 'tm:nsc-atl-0717', name: 'Nashville SC v Atlanta United FC', date: '2026-07-17', venue: 'GEODIS Park', capacity: 30000, kind: 'sports' }),
  tm({ id: 'tm:nsc-mtl-0722', name: 'Nashville SC v CF Montréal', date: '2026-07-22', venue: 'GEODIS Park', capacity: 30000, kind: 'sports' }),
  tm({ id: 'tm:liverpool-0725', name: 'Liverpool FC v Sunderland A.F.C.', date: '2026-07-25', venue: 'GEODIS Park', capacity: 30000, kind: 'sports', selloutLikely: true }),
];

const mcc = (id: string, name: string, date: string, att: number): RawEvent => ({
  id, name: `Music City Center: ${name}`, date, venue: 'Music City Center',
  capacity: null, expectedAttendance: att, kind: 'convention', source: 'calendars',
});
const calendarEvents: RawEvent[] = [
  mcc('mcc:8591:2026-07-22', 'Firehouse Sub 2026', '2026-07-22', 950),
  mcc('mcc:8591:2026-07-23', 'Firehouse Sub 2026', '2026-07-23', 950),
  mcc('mcc:10205:2026-07-26', 'Engage Nashville', '2026-07-26', 500),
  mcc('mcc:7637:2026-07-29', 'National Urban League Annual Conference', '2026-07-29', 4000),
  mcc('mcc:7637:2026-07-30', 'National Urban League Annual Conference', '2026-07-30', 4000),
  mcc('mcc:7637:2026-07-31', 'National Urban League Annual Conference', '2026-07-31', 4000),
];

const weather: WeatherAlert[] = [
  {
    event: 'Flood Watch',
    severity: 'Severe',
    headline: 'Flood Watch issued July 12 at 1:06PM CDT until July 12 at 6:00PM CDT by NWS Nashville TN',
    isWinter: false,
    area: 'Williamson County + Davidson County',
  },
];

const rates: RateCheck[] = [
  { source: 'redroof', status: 'ok', price: 68, room: 'Deluxe King / 2 Queen NS, flexible rate', fetchedAt: AT },
  { source: 'google', status: 'ok', price: 59, room: 'via "Official Site" link on Google Hotels', fetchedAt: AT },
  { source: 'expedia', status: 'ok', price: 68, room: '1 Queen / 1 King / 2 Queen', fetchedAt: AT },
  { source: 'booking', status: 'ok', price: 68, room: 'cheapest room, taxes excluded', fetchedAt: AT },
];

// Competitor prices — read live off the same Google Hotels page (check-in Jul 13)
const compset = [
  { name: 'Clarion Pointe Franklin - Nashville Area', price: 52 },
  { name: 'Comfort Inn Franklin Highway 96', price: 53 },
  { name: 'Holiday Inn Franklin - Cool Springs by IHG', price: 57 },
  { name: 'Candlewood Suites Nashville - Franklin by IHG', price: 72 },
  { name: 'Tru by Hilton Franklin Cool Springs Nashville', price: 91 },
];

const bundle: Bundle = {
  runAt: AT,
  sources: [
    { source: 'ticketmaster', status: 'ok', fetchedAt: AT, data: tmEvents },
    { source: 'cfbd', status: 'failed', fetchedAt: AT, error: 'Not reachable from demo environment (requires Authorization header); runs normally in GitHub Actions. No Vandy home games fall in this window anyway (season starts late August).' },
    { source: 'nws', status: 'ok', fetchedAt: AT, data: weather },
    { source: 'faa', status: 'ok', fetchedAt: AT, data: { bnaDisrupted: false } },
    { source: 'calendars', status: 'ok', fetchedAt: AT, data: calendarEvents, error: 'Belmont calendar returned an empty shell to plain fetch — warned & skipped (structure note in README).' },
    { source: 'rates', status: 'ok', fetchedAt: AT, data: { checks: rates, compset, compsetDate: '2026-07-13' } },
  ],
};

async function main() {
  const store = new FileStore('.data/demo-store.json');
  const summary = await processBundle(bundle, store, NOW);

  console.log('=== INGEST SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  const snap = (await store.get('snapshot:latest')) as import('../lib/scoring/types').Snapshot;
  console.log('\n=== TONIGHT (2026-07-12) ===');
  const tonight = snap.nights[0];
  for (const t of tonight.tiers) console.log(`  ${t.label}: $${t.recommended} (range $${t.range[0]}-$${t.range[1]})`);
  console.log(`  night score: ${tonight.nightScore} | uplift: ${tonight.upliftPct}% | confidence: ${snap.confidence}% (${snap.confidenceNote})`);
  for (const r of tonight.reasoning) console.log(`  • ${r}`);

  console.log('\n=== NIGHTS WITH SIGNAL (next 21) ===');
  for (const n of snap.nights.slice(1)) {
    if (n.events.length === 0) continue;
    const std = n.tiers.find((t) => t.tierId === 'standard')!;
    console.log(`\n${n.date} — score ${n.nightScore}, uplift ${n.upliftPct}%, standard $${std.recommended} [${std.range[0]}-${std.range[1]}]`);
    for (const e of n.events) {
      console.log(`   ${e.tier.padEnd(11)} ${String(e.score).padStart(5)}  ${e.name} (~${Math.round(e.attendanceEstimate / 1000)}k est) — ${e.verdict}`);
    }
  }

  console.log('\n=== RATE PARITY (checked live, Jul 13→14; google informational only) ===');
  for (const p of snap.parity) console.log(`  ${p.source.padEnd(8)} ${p.status === 'ok' ? `$${p.price}` : 'needs manual check'}  ${p.room ?? p.error ?? ''}`);

  console.log('\n=== NEARBY COMPETITORS (live, check-in Jul 13) ===');
  if (snap.compset) {
    for (const c of snap.compset.entries) console.log(`  $${String(c.price).padStart(3)}  ${c.name}`);
    console.log(`  median: $${snap.compset.median}`);
    const tomorrow = snap.nights.find((n) => n.date === snap.compset!.date);
    console.log(`  → tomorrow (${snap.compset.date}) recommendation after compset bound:`);
    for (const t of tomorrow!.tiers) console.log(`     ${t.label}: $${t.recommended} (range $${t.range[0]}-$${t.range[1]})`);
    console.log(`     ${tomorrow!.reasoning[tomorrow!.reasoning.length - 1]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
