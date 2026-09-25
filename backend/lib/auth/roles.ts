/**
 * Role policy — pure, dependency-free, safe in both bundles.
 *
 * Kept apart from guard.ts on purpose: guard.ts reaches for the NextAuth
 * session (and through it the store, and through that node:fs), so a client
 * component importing the policy from there drags the server into the browser
 * bundle. The rule itself is just an ordering, so it lives alone here.
 *
 * Levels, ascending:
 *   viewer  — read the dashboard. No writes at all.
 *   manager — operational writes: baselines, current rates, watchlist, notes,
 *             recorded actuals, recompute, on-demand collection.
 *   owner   — everything a manager can do, plus the team invite list.
 */

export type Role = 'owner' | 'manager' | 'viewer';

const RANK: Record<Role, number> = { viewer: 0, manager: 1, owner: 2 };

/**
 * Does `role` meet `required`? An absent or unrecognized role is treated as
 * `viewer` — least privilege, so a malformed token can never grant a write.
 */
export function roleAtLeast(role: string | null | undefined, required: Role): boolean {
  const have = RANK[(role ?? '') as Role] ?? RANK.viewer;
  return have >= RANK[required];
}
