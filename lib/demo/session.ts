/**
 * Demo-session primitives. Edge-safe on purpose — the middleware imports this,
 * so nothing here may touch the store, the filesystem, or next/headers.
 */

/** Names the sandbox, not the visitor. Not a credential: it guards no real data. */
export const DEMO_COOKIE = 'rr_demo';

/** A sandbox — and the cookie naming it — lives a day, then sweeps itself. */
export const DEMO_TTL_SECONDS = 24 * 60 * 60;

/**
 * The cookie's value is concatenated into a Redis key, so it is validated on
 * the way in rather than trusted. A UUID is the only shape accepted: it keeps
 * every sandbox namespace bounded and well-formed, and a hand-edited cookie
 * fails the check and is treated as no demo session at all.
 */
const SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidDemoSid(sid: string | undefined | null): sid is string {
  return typeof sid === 'string' && SID.test(sid);
}

export function newDemoSid(): string {
  return crypto.randomUUID();
}

/**
 * Key namespace for one sandbox. Every demo read and write goes through a
 * store wrapped in this prefix, which is why a demo visitor can exercise the
 * real mutating endpoints without reaching a single production key.
 */
export function demoPrefix(sid: string): string {
  return `demo:${sid}:`;
}
