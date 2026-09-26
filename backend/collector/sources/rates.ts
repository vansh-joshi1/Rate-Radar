import { createSerpApiClient, type SerpApiClient, type SerpProperty, type SerpPropertyDetails } from './serpapi';
import { planSearches, horizonDates, type SearchPlan } from '../budget';
import { loadProperties, mapRoomToTier, type RatePropertyConfig, type RoomTierRule } from '../properties';
import type { CompsetConfig } from '../../lib/scoring/compset';
import { addDays, todayIn } from '../../lib/date';
import type { CompsetEntry, RateCheck, RoomRate, SourceResult } from '../../lib/scoring/types';

/**
 * Competitor and parity prices, from SerpApi's google_hotels engine.
 *
 * This replaced a Playwright scraper that could no longer reach even our own
 * site. Two calls now cover what it attempted:
 *
 *   searchProperties(location, date)  → every nearby hotel priced for that night
 *   propertyDetails(ourToken, date)   → every channel selling us, plus room rates
 *
 * The functions below that map those responses onto `CompsetEntry` / `RateCheck`
 * are pure and fixture-tested; the fetching is not, which is the same boundary
 * the scraper-era tests drew. Everything downstream sees domain types only, so
 * changing vendor means changing this file and `serpapi.ts` and nothing else.
 */

function priceOf(rate?: { extracted_lowest?: number }): number | undefined {
  return typeof rate?.extracted_lowest === 'number' ? rate.extracted_lowest : undefined;
}

export interface CompsetMapping {
  entries: CompsetEntry[];
  /** Watchlist name → property_token, for ingest to persist so later runs match exactly. */
  resolvedTokens: Record<string, string>;
  /** Watchlist hotels Google Hotels does not carry at all. */
  notFound: string[];
  /** Listed, but with no rate for this date — genuinely sold out, not a failure. */
  unavailable: string[];
}

/**
 * Match a location search against the watchlist.
 *
 * Iterates properties (not competitors) so the output keeps the order Google
 * returned, which is roughly proximity. Each competitor is claimed once —
 * a token match first, since names drift and tokens do not.
 */
export function toCompsetEntries(
  properties: SerpProperty[],
  compset: CompsetConfig,
  opts: { excludeToken?: string; knownTokens?: Record<string, string> } = {}
): CompsetMapping {
  const { competitors, priceSanity } = compset;
  const knownTokens = opts.knownTokens ?? {};

  const claimed = new Set<string>();
  const entries: CompsetEntry[] = [];
  const resolvedTokens: Record<string, string> = {};
  const unavailable: string[] = [];

  for (const property of properties) {
    const name = property.name;
    if (!name) continue;
    if (opts.excludeToken && property.property_token === opts.excludeToken) continue;

    const byToken = competitors.find(
      (c) => !claimed.has(c) && knownTokens[c] && knownTokens[c] === property.property_token
    );
    const lower = name.toLowerCase();
    const competitor =
      byToken ?? competitors.find((c) => !claimed.has(c) && lower.includes(c.toLowerCase()));
    if (!competitor) continue;

    claimed.add(competitor);
    if (property.property_token) resolvedTokens[competitor] = property.property_token;

    const price = priceOf(property.rate_per_night);
    if (price === undefined) {
      unavailable.push(name);
      continue;
    }
    if (price < priceSanity.min || price > priceSanity.max) continue;

    entries.push({ name, price });
  }

  // A competitor we never resolved a token for is genuinely absent from Google
  // Hotels. One we HAVE priced before but cannot see now is sold out — some
  // properties drop out of results entirely rather than listing without a rate.
  const missing = competitors.filter((c) => !claimed.has(c));
  const seenBefore = (c: string) => Boolean(knownTokens[c]);

  return {
    entries,
    resolvedTokens,
    notFound: missing.filter((c) => !seenBefore(c)),
    unavailable: [...unavailable, ...missing.filter(seenBefore)],
  };
}

/**
 * Every room rate the channels expose for our property, cheapest per room.
 *
 * Caveat worth remembering: these are rooms as listed by OTAs, not by our own
 * booking engine — the official listing reports one nightly rate and no
 * breakdown. Good enough to tell Standard from Superior, which is what the
 * tier recommendation needs, but it is not our direct rate card.
 */
export function toRoomRates(details: SerpPropertyDetails, roomTierMap: RoomTierRule[]): RoomRate[] {
  const cheapest = new Map<string, number>();

  for (const channel of details.featured_prices ?? []) {
    for (const room of channel.rooms ?? []) {
      const name = room.name?.trim();
      const price = priceOf(room.rate_per_night);
      if (!name || price === undefined) continue;
      const seen = cheapest.get(name);
      if (seen === undefined || price < seen) cheapest.set(name, price);
    }
  }

  return [...cheapest.entries()].map(([room, price]) => ({
    room,
    price,
    tierId: mapRoomToTier(room, roomTierMap),
  }));
}

/**
 * One parity row per channel selling our property.
 *
 * Every channel is kept, not a hard-coded four: the parity question that
 * matters is whether anyone is undercutting our direct rate, and the answer is
 * usually a reseller nobody thought to scrape. Filtering is left to the UI so
 * ingest never throws away a price it cannot get back.
 */
export function toParityChecks(
  details: SerpPropertyDetails,
  roomTierMap: RoomTierRule[],
  fetchedAt: string
): RateCheck[] {
  const rooms = toRoomRates(details, roomTierMap);

  return (details.prices ?? []).map((channel) => {
    const price = priceOf(channel.rate_per_night);
    const official = channel.official === true;
    return {
      source: channel.source ?? 'unknown',
      ...(official ? { official } : {}),
      status: price === undefined ? ('needs-manual-check' as const) : ('ok' as const),
      ...(price !== undefined ? { price } : {}),
      ...(official && rooms.length > 0 ? { rooms } : {}),
      fetchedAt,
    };
  });
}

export interface RatesData {
  checks: RateCheck[];
  compsets: { date: string; entries: CompsetEntry[] }[];
  resolvedPropertyTokens?: Record<string, string>;
  budget: {
    tier: SearchPlan['tier'];
    spent: number;
    remaining: number;
    usedThisMonth: number;
    perMonth?: number;
    renewalDate?: string;
    skipped: SearchPlan['skipped'];
    notFound: string[];
    unavailable: string[];
  };
}

export async function collect(
  prop: RatePropertyConfig = loadProperties()[0],
  deps: {
    client?: SerpApiClient;
    now?: Date;
    /** Hotels drawing on the same SerpApi quota this run; each plans against its share. */
    share?: number;
  } = {}
): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  const now = deps.now ?? new Date();

  const apiKey = process.env.SERPAPI_KEY;
  if (!deps.client && !apiKey) {
    return { source: 'rates', status: 'awaiting-key', fetchedAt, error: 'SERPAPI_KEY unset' };
  }
  if (!prop.serpapi?.query) {
    return { source: 'rates', status: 'failed', fetchedAt, error: `No serpapi.query configured for ${prop.id}` };
  }

  const client = deps.client ?? createSerpApiClient(apiKey!);

  try {
    const quota = await client.accountQuota();

    const today = todayIn(prop.timezone ?? 'America/Chicago', now);
    const dates = horizonDates(today);
    const plan = planSearches({
      // ponytail: an even split of what is left, re-read per hotel; weight by hotel size if one needs more.
      remaining: Math.floor(quota.remaining / Math.max(1, deps.share ?? 1)),
      renewalDate: quota.renewalDate,
      now,
      dates,
    });

    console.log(
      `[rates] budget tier=${plan.tier} remaining=${quota.remaining}/${quota.perMonth ?? '?'} ` +
        `renews=${quota.renewalDate ?? 'unknown'} → ${plan.compsetDates.length} compset search(es)` +
        `${plan.propertyDetails ? ' + property details' : ''}`
    );

    const knownTokens = Object.fromEntries(
      (prop.watchlistHotels ?? [])
        .filter((h) => h.propertyToken)
        .map((h) => [h.name, h.propertyToken!])
    );

    const compsets: { date: string; entries: CompsetEntry[] }[] = [];
    const resolvedTokens: Record<string, string> = {};
    let notFound: string[] = [];
    let unavailable: string[] = [];
    let spent = 0;

    for (const date of plan.compsetDates) {
      const properties = await client.searchProperties(prop.serpapi.query, date, addDays(date, 1));
      spent += 1;
      const mapped = toCompsetEntries(properties, prop.compset, {
        excludeToken: prop.serpapi.propertyToken,
        knownTokens,
      });
      compsets.push({ date, entries: mapped.entries });
      Object.assign(resolvedTokens, mapped.resolvedTokens);
      // Coverage is a property of the search, not the date — report the first.
      if (date === plan.compsetDates[0]) {
        notFound = mapped.notFound;
        unavailable = mapped.unavailable;
      }
      console.log(`[rates] ${date}: ${mapped.entries.length} comps priced, ${mapped.notFound.length} not carried`);
    }

    let checks: RateCheck[] = [];
    if (plan.propertyDetails && prop.serpapi.propertyToken) {
      // Parity is measured for tonight — the rate a guest booking right now sees.
      const details = await client.propertyDetails(
        prop.serpapi.propertyToken,
        prop.serpapi.query,
        today,
        addDays(today, 1)
      );
      spent += 1;
      checks = toParityChecks(details, prop.roomTierMap, fetchedAt);
      const official = checks.find((c) => c.official);
      const cheapest = checks.filter((c) => !c.official && c.price != null).sort((a, b) => a.price! - b.price!)[0];
      console.log(
        `[rates] parity: ${checks.length} channels, direct $${official?.price ?? '?'}` +
          (cheapest ? `, cheapest $${cheapest.price} (${cheapest.source})` : '')
      );
    }

    const data: RatesData = {
      checks,
      compsets,
      ...(Object.keys(resolvedTokens).length > 0 ? { resolvedPropertyTokens: resolvedTokens } : {}),
      budget: {
        tier: plan.tier,
        spent,
        remaining: quota.remaining - spent,
        usedThisMonth: quota.usedThisMonth + spent,
        ...(quota.perMonth !== undefined ? { perMonth: quota.perMonth } : {}),
        ...(quota.renewalDate ? { renewalDate: quota.renewalDate } : {}),
        skipped: plan.skipped,
        notFound,
        unavailable,
      },
    };

    return { source: 'rates', status: 'ok', fetchedAt, data };
  } catch (err) {
    return { source: 'rates', status: 'failed', fetchedAt, error: String(err).slice(0, 300) };
  }
}
