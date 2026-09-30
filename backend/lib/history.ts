import type { Store } from './store';
import type { HistoryRecord } from './scoring/types';

/** Days of daily history kept. Covers Growth's 12-month view with a margin. */
export const HISTORY_KEPT = 400;

/**
 * The daily records dated after `since`, newest first. The `history` hash is
 * one row, so reading it whole is one query rather than one per day; ingest
 * prunes it to HISTORY_KEPT days so the row stays bounded.
 */
export async function recentHistory(store: Store, since: string): Promise<HistoryRecord[]> {
  return Object.values(await store.hgetall<HistoryRecord>('history'))
    .filter((rec) => rec.date > since)
    .sort((a, b) => b.date.localeCompare(a.date));
}
