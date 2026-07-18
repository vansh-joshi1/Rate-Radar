import { getStore } from './store';
import type { Snapshot } from './scoring/types';
import { demoSnapshot } from './demo';

/** Latest collector snapshot, or the sample snapshot when the store is empty. */
export async function loadSnapshot(): Promise<{ snapshot: Snapshot; isDemo: boolean }> {
  const real = await getStore().get<Snapshot>('snapshot:latest');
  if (real) return { snapshot: real, isDemo: false };
  return { snapshot: demoSnapshot(), isDemo: true };
}
