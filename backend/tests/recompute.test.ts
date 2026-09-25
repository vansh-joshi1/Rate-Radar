import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { processBundle, type Bundle } from '../lib/ingest';
import { saveRatesConfig } from '../lib/rates-config';
import type { Snapshot } from '../lib/scoring/types';

const PROP = 'rri-franklin';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-rq-')), 'store.json'));
}

describe('recompute from the stored bundle', () => {
  it('ingest stores the raw bundle; reprocessing honors edited baselines', async () => {
    const store = freshStore();
    const bundle: Bundle = { runAt: new Date().toISOString(), sources: [] };
    await processBundle(bundle, store);

    // raw bundle persisted for /api/recompute
    const stored = await store.get<Bundle>(`prop:${PROP}:bundle:latest`);
    expect(stored?.runAt).toBe(bundle.runAt);

    // a quiet Saturday recommends the default weekend midpoint ($85)
    const snap1 = await store.get<Snapshot>(`prop:${PROP}:snapshot:latest`);
    const sat1 = snap1!.nights.find((n) => n.dow === 6 && n.nightScore === 0)!;
    expect(sat1.tiers.find((t) => t.tierId === 'standard')!.recommended).toBe(85);

    // owner lowers weekend baselines, then the SAME bundle is reprocessed
    await saveRatesConfig(store, PROP, {
      tiers: [
        {
          id: 'standard', label: 'Standard',
          weekday: { min: 60, max: 70 }, sunday: { min: 65, max: 75 }, weekend: { min: 70, max: 80 },
        },
      ],
      upliftCapPct: 40,
    });
    await processBundle(stored!, store);

    const snap2 = await store.get<Snapshot>(`prop:${PROP}:snapshot:latest`);
    expect(snap2!.runAt).toBe(bundle.runAt); // freshness stays honest — same collected data
    const sat2 = snap2!.nights.find((n) => n.date === sat1.date)!;
    expect(sat2.tiers.find((t) => t.tierId === 'standard')!.recommended).toBe(75);
  });
});
