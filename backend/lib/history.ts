import type { Store } from './store';
import type { HistoryRecord } from './scoring/types';

/** Days of history kept: Growth's 12 months plus a margin. */
export const HISTORY_KEPT = 400;

/** Records dated after `since`, newest first. One query: the hash is one row, pruned by ingest. */
export async function recentHistory(store: Store, since: string): Promise<HistoryRecord[]> {
  return Object.values(await store.hgetall<HistoryRecord>('history'))
    .filter((rec) => rec.date > since)
    .sort((a, b) => b.date.localeCompare(a.date));
}
