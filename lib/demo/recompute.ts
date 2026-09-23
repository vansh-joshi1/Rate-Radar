import type { Store } from '../store';
import type { Snapshot } from '../scoring/types';
import { recommendNight } from '../scoring/recommend';
import { loadRatesConfig } from '../rates-config';
import { propKey } from '../properties';
import { demoSnapshot } from '../demo';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Recompute a demo sandbox after a baseline edit.
 *
 * The real `/api/recompute` rescores the last collected bundle. A sandbox has
 * no bundle — nothing was ever collected for an invented hotel — so this
 * rescores the demo world instead, and does it through `recommendNight`, the
 * same function that prices the real property. The demo is therefore not a
 * mock of the pricing engine; it is the pricing engine, run over invented
 * inputs and the visitor's own edited baselines.
 *
 * Event scores, verdicts and comp-set stay as the fixture defines them: the
 * visitor edits baselines, not demand.
 */
export async function recomputeDemoSandbox(store: Store, propertyId: string): Promise<Snapshot> {
  const cfg = await loadRatesConfig(store, propertyId);
  const current = (await store.get<Snapshot>('snapshot:latest')) ?? demoSnapshot();

  const nights = current.nights.map((night) => {
    const tiers = recommendNight(night.date, night.nightScore, cfg);
    const anchor = tiers[0];
    // Keep the reasoning honest: its first line quotes the baseline, and that
    // is exactly the number the visitor just changed. Named by the night's own
    // weekday, matching how the fixture writes it.
    const label = DAY_NAMES[new Date(`${night.date}T12:00:00Z`).getUTCDay()];
    const rest = night.reasoning.slice(1);
    return {
      ...night,
      tiers,
      reasoning: anchor ? [`${label} baseline $${Math.round(anchor.baselineMid)}`, ...rest] : night.reasoning,
    };
  });

  const next: Snapshot = { ...current, nights, runAt: new Date().toISOString() };
  await Promise.all([
    store.set('snapshot:latest', next),
    store.set(propKey.snapshotLatest(propertyId), next),
  ]);
  return next;
}
