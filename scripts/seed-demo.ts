/**
 * Seed the store with the sample snapshot — local/dev convenience so the
 * dashboard and v1 API have data before the first real collector run.
 *
 *   npx tsx scripts/seed-demo.ts
 */
import { getStore } from '../lib/store';
import { demoSnapshot } from '../lib/demo';
import { DEFAULT_PROPERTY_ID, propKey } from '../lib/properties';

async function main() {
  const snapshot = demoSnapshot();
  const store = getStore();
  await store.set(propKey.snapshotLatest(DEFAULT_PROPERTY_ID), snapshot);
  await store.set('snapshot:latest', snapshot);
  console.log(`Seeded sample snapshot for ${DEFAULT_PROPERTY_ID} (runAt ${snapshot.runAt})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
