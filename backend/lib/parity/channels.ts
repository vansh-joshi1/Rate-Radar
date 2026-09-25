import type { RateCheck } from '../scoring/types';

/**
 * Which booking channels parity is reported against.
 *
 * Google Hotels lists ~26 channels selling this property. Everything that
 * reads parity — the v1 API, the Competitors page, the alert rules — reports
 * only three of them: the direct listing, Booking.com, and Expedia.com.
 *
 * WHAT THIS COSTS, recorded so it is a decision and not a surprise. The
 * channel undercutting the direct rate is usually a reseller nobody would
 * think to check: in the run this rule was written against, direct was $80
 * with Booking and Expedia both at $81 — clean — while Super.com sold the
 * same room at $62 and dealbase.com at $64. Under this policy that $18
 * undercut is not reported anywhere, and `parityGapUsd` reads $1 rather than
 * $19. That is the owner's call: these are the three channels a human
 * actually acts on, and 26 rows of resellers is noise.
 *
 * The filter runs at READ time and the stored snapshot keeps all 26. The
 * collector already spent a metered SerpApi search to fetch them, keeping
 * them costs nothing, and widening the policy later is then an edit to
 * TRACKED_CHANNELS rather than a gap in the history.
 */

/**
 * Normalised names of the non-direct channels reported.
 *
 * Exact matches after normalisation, never substrings and never brand
 * families. Hotels.com, Travelocity, Orbitz and CheapTickets are all Expedia
 * Group and all appear in live data — "Expedia" here means Expedia, not its
 * family. Substring matching would also claim any reseller whose name merely
 * contains "booking".
 */
export const TRACKED_CHANNELS: readonly string[] = ['booking', 'expedia'];

/** Stated in the v1 API's provenance block so a consumer can tell 3-of-26 from 3-of-3. */
export const CHANNEL_POLICY = 'direct + booking.com + expedia.com';

/** Lowercase, trim, drop a trailing `.com` — "Expedia.com", "expedia" and "Expedia" are one channel. */
function normalize(source: string): string {
  return source.trim().toLowerCase().replace(/\.com$/, '');
}

/**
 * The direct listing is matched on the `official` flag, never by name: that
 * entry carries the property's own name ("Red Roof Inn Nashville - Franklin"),
 * so a name rule would work for exactly one hotel.
 *
 * A tracked channel that reported no price is still tracked — absence of a
 * price is information, and this filter decides WHICH channel, not whether it
 * answered.
 */
export function isTrackedChannel(check: Pick<RateCheck, 'source' | 'official'>): boolean {
  if (check.official === true) return true;
  return TRACKED_CHANNELS.includes(normalize(check.source));
}

/** The reported subset, in the order the collector returned it. */
export function trackedParity(parity: RateCheck[]): RateCheck[] {
  return parity.filter(isTrackedChannel);
}
