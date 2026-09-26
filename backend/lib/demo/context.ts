import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getStore, prefixed, storeFor, type Store } from '../store';
import { DEFAULT_PROPERTY_ID, DEMO_PROPERTY, getProperty, loadProperty, propKey, type Property } from '../properties';
import { DEMO_COOKIE, DEMO_TTL_SECONDS, demoPrefix, isValidDemoSid } from './session';
import { demoSnapshot, DEMO_NEARBY_HOTELS } from '../demo';
import { watchlistKey, type WatchlistHotel } from '../watchlist';

/**
 * Request-scoped demo context — the seam between "this is the real hotel" and
 * "this is a sandbox".
 *
 * Pages and route handlers call `requestStore()` and `requestProperty()`
 * instead of reaching for `getStore()` / `getProperty()` directly. In an
 * ordinary session both return exactly what they always did. In a demo session
 * they return a namespaced store and an invented property, so the same code
 * path renders a sandbox without knowing it is doing so.
 *
 * Only request-serving code should use this module; the collector and scripts
 * run outside a request and keep calling `getStore()`.
 */

/**
 * The validated sandbox id on this request, or null for an ordinary session.
 *
 * Safe to call from anywhere: `cookies()` throws outside a request scope, and
 * the collector, the scripts and the test suite all run there. Those contexts
 * are never a demo, so the throw means null rather than an error.
 */
export function demoSid(): string | null {
  let raw: string | undefined;
  try {
    raw = cookies().get(DEMO_COOKIE)?.value;
  } catch {
    return null;
  }
  return isValidDemoSid(raw) ? raw : null;
}

/**
 * The store this request may touch. A demo request gets a view namespaced to
 * its own sandbox, with every write given a rolling 24h expiry so an abandoned
 * demo costs nothing and no cleanup job is needed. Anyone else gets their own
 * hotel's store (see `storeFor`).
 */
export async function requestStore(): Promise<Store> {
  const sid = demoSid();
  if (sid) return prefixed(getStore(), demoPrefix(sid), DEMO_TTL_SECONDS);
  return storeFor((await requestProperty()).id);
}

/**
 * The property this request is about: the invented one inside a demo, the
 * signed-in member's own hotel otherwise. Never a caller-supplied id.
 *
 * No member session means no property, not the default one: a signed-in
 * stranger (pending request, removed teammate) is sent to /login rather than
 * shown the original hotel. Local dev without Supabase has no sessions at all
 * and gets the original property, as it always has.
 */
export async function requestProperty(): Promise<Property> {
  if (demoSid()) return DEMO_PROPERTY;
  // Deferred, as in guard.ts: keeps the Supabase graph out of modules that only need the demo seam.
  const { auth, authConfigured } = await import('../../auth');
  if (!authConfigured()) return getProperty(DEFAULT_PROPERTY_ID)!;
  const session = await auth();
  const property = session && (await loadProperty(getStore(), session.user.propertyId));
  if (!property) redirect('/login');
  return property;
}

/**
 * Refuse an action whose effects would leave the sandbox.
 *
 * The store prefix contains everything a demo visitor can write, but it cannot
 * contain an email that has been sent or a metered API search that has been
 * spent. Those endpoints call this instead of doing the work, and say plainly
 * why — a demo that silently pretends to send an invite teaches the reader the
 * wrong thing about the product.
 *
 * 200, not 403: nothing went wrong, and the UI shows the message as-is.
 */
export function demoRefusal(message: string): NextResponse {
  return NextResponse.json({ ok: false, demo: true, message }, { status: 200 });
}

/**
 * Fill a fresh sandbox with the demo world.
 *
 * Idempotent by design: `/demo` calls it on entry, and it is also the repair
 * path for a sandbox whose keys expired mid-visit, so a visitor who leaves a
 * tab open overnight finds a working dashboard rather than an empty one.
 */
export async function seedDemoSandbox(store: Store): Promise<void> {
  const snapshot = demoSnapshot();
  const id = DEMO_PROPERTY.id;
  // The watchlist MUST be seeded, not left to `loadWatchlist`'s first-read
  // default: that default is config/compset.json, the real property's actual
  // competitor whitelist, which would put a dozen real hotel brands into a
  // market that is otherwise entirely invented.
  const watchlist: WatchlistHotel[] = DEMO_NEARBY_HOTELS.map((h) => ({
    name: h.name,
    lat: h.lat,
    lng: h.lng,
    address: h.address,
    addedAt: new Date(0).toISOString(),
  }));
  await Promise.all([
    store.set(propKey.snapshotLatest(id), snapshot),
    // The legacy unscoped key the dashboard still reads.
    store.set('snapshot:latest', snapshot),
    store.set(watchlistKey(id), watchlist),
  ]);
}

/** True when the sandbox has no snapshot yet (fresh or expired). */
export async function sandboxNeedsSeed(store: Store): Promise<boolean> {
  return (await store.get('snapshot:latest')) === null;
}
