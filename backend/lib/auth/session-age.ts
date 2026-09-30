/**
 * How long a sign-in lasts. Edge-safe: the middleware imports it.
 *
 * Supabase refresh tokens never expire on their own, so without this a session
 * lasts forever. The shared front-desk login sits on shared machines with the
 * owner role, and changing SITE_PASSWORD signs nobody out, so it gets a shift
 * rather than a week.
 */

/** The shared-password identity. Never emailed; `.invalid` is reserved and can't receive mail. */
export const SHARED_LOGIN_EMAIL = 'front-desk@rate-radar.invalid';

const HOUR = 3600;
export const MAX_SESSION_SECONDS = { shared: 12 * HOUR, personal: 7 * 24 * HOUR };

/**
 * Has this session outlived its sign-in? Measured from the latest `amr` entry,
 * the moment the person last proved who they are. Unlike `iat`, it does not
 * move when the token refreshes. A token without timestamps (a custom
 * access-token hook) can't be judged and is let through rather than looped
 * back to /login forever.
 */
export function sessionExpired(claims: { email?: string; amr?: unknown[] }, nowMs = Date.now()): boolean {
  // A string entry has no .timestamp, so it counts as 0.
  const signedInAt = Math.max(0, ...(claims.amr ?? []).map((a) => Number((a as { timestamp?: number }).timestamp) || 0));
  if (!signedInAt) return false;
  const max = claims.email === SHARED_LOGIN_EMAIL ? MAX_SESSION_SECONDS.shared : MAX_SESSION_SECONDS.personal;
  return nowMs / 1000 - signedInAt > max;
}
