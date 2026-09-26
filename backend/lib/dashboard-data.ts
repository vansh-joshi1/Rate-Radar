import type { Snapshot } from './scoring/types';
import { demoSnapshot } from './demo';
import { requestStore, requestProperty, demoSid } from './demo/context';

/**
 * Latest collector snapshot, or the sample snapshot when the store is empty.
 *
 * Inside a demo sandbox `requestStore()` is namespaced, so "the store" is that
 * visitor's own copy of the invented world — seeded on entry and edited by
 * whatever they have done since. The real property's snapshot is not reachable
 * from here on a demo request.
 *
 * `awaitingFirstRun`: a hotel approved from onboarding whose first collection
 * has not happened yet. It still gets the sample snapshot, so every page
 * renders, but the layout covers those pages with a setting-up notice rather
 * than show an invented town's events under a real hotel's name.
 */
export async function loadSnapshot(): Promise<{ snapshot: Snapshot; isDemo: boolean; awaitingFirstRun: boolean }> {
  const inDemo = demoSid() !== null;
  const real = await (await requestStore()).get<Snapshot>('snapshot:latest');
  if (real) return { snapshot: real, isDemo: inDemo, awaitingFirstRun: false };
  const awaitingFirstRun = !inDemo && Boolean((await requestProperty()).collect);
  return { snapshot: demoSnapshot(), isDemo: true, awaitingFirstRun };
}
