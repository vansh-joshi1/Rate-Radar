import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { FileStore, prefixed } from '../lib/store';
import { demoPrefix, isValidDemoSid } from '../lib/demo/session';
import { demoSnapshot, DEMO_NEARBY_HOTELS } from '../lib/demo';
import { DEMO_PROPERTY, PROPERTIES, getProperty } from '../lib/properties';
import { seedDemoSandbox } from '../lib/demo/context';
import { isTrackedChannel } from '../lib/parity/channels';
import { loadWatchlist } from '../lib/watchlist';
import defaultCompset from '../config/compset.json';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-demo-')), 'store.json'));
}

const SID = '0b8c3a2e-1f4d-4c8a-9b7e-2d6f5a1c3e90';

describe('sandbox key namespacing', () => {
  it('keeps a demo write out of the production key', async () => {
    const store = freshStore();
    await store.set('snapshot:latest', { runId: 'real' });

    const sandbox = prefixed(store, demoPrefix(SID));
    await sandbox.set('snapshot:latest', { runId: 'demo' });

    expect(await store.get('snapshot:latest')).toEqual({ runId: 'real' });
    expect(await sandbox.get('snapshot:latest')).toEqual({ runId: 'demo' });
  });

  it('namespaces hashes, lists and counters too', async () => {
    const store = freshStore();
    const sandbox = prefixed(store, demoPrefix(SID));

    await sandbox.hset('notes', '2026-09-22', 'sandbox note');
    await sandbox.lpush('runs', 'sandbox run');
    await sandbox.incr('collect-now:throttle', 60);

    expect(await store.hget('notes', '2026-09-22')).toBeNull();
    expect(await store.lrange('runs', 0, -1)).toEqual([]);
    // The real throttle counter is untouched, so a demo visitor cannot burn it.
    expect(await store.get('collect-now:throttle')).toBeNull();

    expect(await sandbox.hget('notes', '2026-09-22')).toBe('sandbox note');
  });

  it('gives two sandboxes separate worlds', async () => {
    const store = freshStore();
    const a = prefixed(store, demoPrefix(SID));
    const b = prefixed(store, demoPrefix('11111111-2222-4333-8444-555555555555'));

    await a.set('current-rates', { standard: 99 });
    expect(await b.get('current-rates')).toBeNull();
  });
});

describe('demo session ids', () => {
  it('accepts a UUID', () => {
    expect(isValidDemoSid(SID)).toBe(true);
  });

  it('rejects anything else, because the value becomes a storage key', () => {
    for (const bad of ['', '..', '../../snapshot', 'a:b', 'snapshot:latest', 'x'.repeat(200), undefined, null]) {
      expect(isValidDemoSid(bad)).toBe(false);
    }
  });
});

describe('the demo world is invented', () => {
  const real = PROPERTIES[0];
  const fixture = JSON.stringify([demoSnapshot(), DEMO_NEARBY_HOTELS, DEMO_PROPERTY]);

  it('never names the real property, its brand or its town', () => {
    for (const term of [real.name, real.city, 'Red Roof', 'Franklin', 'Nashville', 'RRI1430', 'Carothers']) {
      expect(fixture).not.toContain(term);
    }
  });

  it('never attaches invented prices to a real hotel brand', () => {
    for (const term of ['Hampton', 'Holiday Inn', 'Quality Inn', 'Comfort Inn', 'Baymont', 'La Quinta',
      'Super 8', 'Motel 6', 'Hilton', 'Marriott', 'Best Western', 'Clarion', 'Candlewood', 'Drury']) {
      expect(fixture).not.toContain(term);
    }
  });

  /**
   * Booking channels are the deliberate exception, decided 2026-09-22.
   *
   * lib/parity/channels.ts tracks 'booking' and 'expedia' by exact name, so a
   * demo with invented channels would render its parity panel with the direct
   * row alone — the headline feature demonstrating nothing. The market is
   * invented; the channels are the integrations the product genuinely reports
   * against, shown under a standing "sample data" badge.
   */
  it('still reaches the tracked channels, so the parity panel has something to show', () => {
    const tracked = demoSnapshot().parity.filter(isTrackedChannel);
    expect(tracked.some((c) => c.official)).toBe(true);
    expect(tracked.map((c) => c.source)).toEqual(
      expect.arrayContaining(['Booking.com', 'Expedia.com'])
    );
  });

  it('never invents an event for a real venue or performer', () => {
    for (const term of ['Nissan Stadium', 'FirstBank', 'Vanderbilt', 'Vandy', 'Bridgestone', 'Ryman',
      'Morgan Wallen', 'CMA Fest', 'Music City Center']) {
      expect(fixture).not.toContain(term);
    }
  });

  it('keeps the demo property out of the collected registry but resolvable by id', () => {
    expect(PROPERTIES.map((p) => p.id)).not.toContain(DEMO_PROPERTY.id);
    expect(getProperty(DEMO_PROPERTY.id)).toEqual(DEMO_PROPERTY);
  });

  /**
   * Regression: the sandbox used to inherit `loadWatchlist`'s first-read
   * default, which is the real property's competitor whitelist — so the demo
   * listed a dozen real hotel brands alongside its invented ones.
   */
  it('seeds the sandbox watchlist rather than inheriting the real compset whitelist', async () => {
    const store = freshStore();
    const sandbox = prefixed(store, demoPrefix(SID));
    await seedDemoSandbox(sandbox);

    const list = await loadWatchlist(sandbox, DEMO_PROPERTY.id);
    expect(list.length).toBe(DEMO_NEARBY_HOTELS.length);
    expect(list.map((h) => h.name).sort()).toEqual(DEMO_NEARBY_HOTELS.map((h) => h.name).sort());
    for (const real of defaultCompset.competitors as string[]) {
      expect(list.map((h) => h.name)).not.toContain(real);
    }
  });
});

/**
 * Structural guard, in the spirit of tests/role-guard.test.ts.
 *
 * A browser-facing handler that calls `getStore()` reads and writes the REAL
 * property no matter who is asking — which is precisely the bug that would put
 * the live hotel's rates into a public demo. The safe accessor is
 * `requestStore()`, which namespaces the demo and is a no-op otherwise, so the
 * suite fails when a new handler reaches for the raw store instead.
 */
describe('no browser-facing handler touches the production store directly', () => {
  const APP_DIR = join(__dirname, '..', '..', 'frontend', 'app');

  /** Handlers that are NOT browser-facing — each with the reason it may use getStore(). */
  const MACHINE_ROUTES: Record<string, string> = {
    'api/ingest/route.ts': 'collector push, INGEST_SECRET bearer — never a demo caller',
    'api/health/route.ts': 'uptime probe for the watchdog workflow; must report the real pipeline',
    'api/cron/heartbeat/route.ts': 'Vercel cron; must reach the real snapshot',
    'api/v1/properties/route.ts': 'API-key clients, scoped by key — demo sandboxes are not exposed there',
    'api/collect-now/route.ts': 'refuses demo callers before it touches the store',
    'api/recompute/route.ts': 'branches to the sandbox first; the raw store is the non-demo path',
    'api/onboarding/discover/route.ts': 'only a SerpApi spend counter, deliberately global so a demo sandbox cannot bypass the cap',
    'demo/route.ts': 'builds the namespaced view itself — this is where the prefix comes from',
  };

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }

  const files = sourceFiles(APP_DIR);

  it('finds the app files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const rel = relative(APP_DIR, file).split(sep).join('/');
    if (rel in MACHINE_ROUTES) continue;
    const source = readFileSync(file, 'utf8');
    if (!/\bgetStore\(/.test(source)) continue;

    it(`${rel} uses requestStore(), not getStore()`, () => {
      expect(source).not.toMatch(/\bgetStore\(/);
    });
  }
});
