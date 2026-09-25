import type { Snapshot } from './scoring/types';
import { demoSnapshot } from './demo';
import { requestStore, demoSid } from './demo/context';

/**
 * Latest collector snapshot, or the sample snapshot when the store is empty.
 *
 * Inside a demo sandbox `requestStore()` is namespaced, so "the store" is that
 * visitor's own copy of the invented world — seeded on entry and edited by
 * whatever they have done since. The real property's snapshot is not reachable
 * from here on a demo request.
 */
export async function loadSnapshot(): Promise<{ snapshot: Snapshot; isDemo: boolean }> {
  const inDemo = demoSid() !== null;
  const real = await requestStore().get<Snapshot>('snapshot:latest');
  if (real) return { snapshot: real, isDemo: inDemo };
  return { snapshot: demoSnapshot(), isDemo: true };
}
