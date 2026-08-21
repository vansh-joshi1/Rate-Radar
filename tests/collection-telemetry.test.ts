import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import {
  appendRunTelemetry,
  collectionTelemetryKey,
  loadRunTelemetry,
  TELEMETRY_WINDOW,
} from '../lib/collection-telemetry';
import { processBundle, type Bundle } from '../lib/ingest';
import type { RunTelemetry } from '../collector/telemetry';

const store = () => new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-tel-')), 'store.json'));

const run = (n: number): RunTelemetry => ({
  runAt: `2026-08-${String(n).padStart(2, '0')}T12:00:00.000Z`,
  runLeg: 'github-hosted',
  browser: 'playwright',
  profileAgeRuns: 0,
  attempts: [],
});

describe('collection telemetry persistence', () => {
  it('keys are property-scoped', () => {
    expect(collectionTelemetryKey('rri-franklin')).toBe('prop:rri-franklin:collection-telemetry');
  });

  it('newest run comes back first', async () => {
    const s = store();
    await appendRunTelemetry(s, 'p', run(1));
    await appendRunTelemetry(s, 'p', run(2));
    const list = await loadRunTelemetry(s, 'p');
    expect(list[0].runAt).toContain('2026-08-02');
    expect(list).toHaveLength(2);
  });

  it('never grows past the window — Upstash free tier is a real constraint', async () => {
    const s = store();
    for (let i = 1; i <= TELEMETRY_WINDOW + 15; i++) {
      await appendRunTelemetry(s, 'p', run((i % 28) + 1));
    }
    expect(await loadRunTelemetry(s, 'p')).toHaveLength(TELEMETRY_WINDOW);
  });

  it('an unwritten key reads as empty, not null', async () => {
    expect(await loadRunTelemetry(store(), 'never-written')).toEqual([]);
  });
});

describe('ingest persists collector telemetry', () => {
  const telemetry: RunTelemetry = {
    runAt: '2026-08-21T12:00:00.000Z',
    runLeg: 'self-hosted',
    browser: 'patchright',
    profileAgeRuns: 7,
    attempts: [
      { target: 'ours', source: 'redroof', date: '2026-08-22', outcome: 'ok', attempts: 1, durationMs: 900 },
      {
        target: 'Quality Inn',
        source: 'booking-direct',
        date: '2026-08-22',
        outcome: 'blocked',
        attempts: 2,
        durationMs: 40000,
      },
    ],
  };

  const bundleWith = (data: unknown): Bundle => ({
    runAt: new Date().toISOString(),
    sources: [{ source: 'rates', status: 'ok', fetchedAt: new Date().toISOString(), data }],
  });

  it('appends the run to the property-scoped window', async () => {
    const s = store();
    await processBundle(bundleWith({ checks: [], compsets: [], telemetry }), s);

    const list = await loadRunTelemetry(s, 'rri-franklin');
    expect(list).toHaveLength(1);
    expect(list[0].browser).toBe('patchright');
    expect(list[0].runLeg).toBe('self-hosted');
    expect(list[0].attempts).toHaveLength(2);
  });

  it('a bundle with no telemetry writes nothing — older collectors stay compatible', async () => {
    const s = store();
    await processBundle(bundleWith({ checks: [], compsets: [] }), s);
    expect(await loadRunTelemetry(s, 'rri-franklin')).toEqual([]);
  });
});
