/**
 * SerpApi HTTP client — the ONLY file in the project that knows SerpApi exists.
 *
 * Everything downstream consumes `RateCheck[]` / `CompsetEntry[]`, so swapping
 * this vendor later (StayAPI is the named candidate once there is revenue) means
 * replacing this file and the mapping in `rates.ts`, and nothing else.
 *
 * Two SerpApi quirks are handled here so callers never have to:
 *   - Errors arrive as an `error` key in a 200 body, not as an HTTP status.
 *   - `/account` is free — it does not count against the monthly quota — which
 *     is what makes the budget scheduler able to read live remaining every run.
 */

const BASE = 'https://serpapi.com';

/** One property as returned by a location search. Fields we actually read. */
export interface SerpProperty {
  name?: string;
  property_token?: string;
  type?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  rate_per_night?: { lowest?: string; extracted_lowest?: number };
  total_rate?: { lowest?: string; extracted_lowest?: number };
}

/** One booking channel for a property, from the property-details response. */
export interface SerpFeaturedPrice {
  source?: string;
  official?: boolean;
  rate_per_night?: { lowest?: string; extracted_lowest?: number };
  rooms?: {
    name?: string;
    rate_per_night?: { lowest?: string; extracted_lowest?: number };
  }[];
}

export interface SerpPropertyDetails {
  name?: string;
  featured_prices?: SerpFeaturedPrice[];
  prices?: SerpFeaturedPrice[];
}

export interface SerpQuota {
  remaining: number;
  usedThisMonth: number;
  perMonth?: number;
  /** Plan anniversary (YYYY-MM-DD) — what the budget scheduler paces against. */
  renewalDate?: string;
}

export interface SerpApiClient {
  searchProperties(q: string, checkIn: string, checkOut: string): Promise<SerpProperty[]>;
  propertyDetails(token: string, q: string, checkIn: string, checkOut: string): Promise<SerpPropertyDetails>;
  accountQuota(): Promise<SerpQuota>;
}

export function createSerpApiClient(apiKey: string, fetchImpl: typeof fetch = fetch): SerpApiClient {
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, BASE);
    for (const [k, v] of Object.entries({ ...params, api_key: apiKey })) url.searchParams.set(k, v);

    const res = await fetchImpl(url.toString());
    const body = (await res.json()) as T & { error?: string };
    // SerpApi reports failures in the body, sometimes alongside a 200.
    if (body?.error) throw new Error(body.error);
    if (!res.ok) throw new Error(`SerpApi ${path} returned ${res.status}`);
    return body;
  }

  function hotelParams(q: string, checkIn: string, checkOut: string): Record<string, string> {
    return {
      engine: 'google_hotels',
      q,
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults: '2',
      currency: 'USD',
      gl: 'us',
      hl: 'en',
    };
  }

  return {
    async searchProperties(q, checkIn, checkOut) {
      const body = await get<{ properties?: SerpProperty[] }>('/search', hotelParams(q, checkIn, checkOut));
      return body.properties ?? [];
    },

    async propertyDetails(token, q, checkIn, checkOut) {
      return get<SerpPropertyDetails>('/search', {
        ...hotelParams(q, checkIn, checkOut),
        property_token: token,
      });
    },

    async accountQuota() {
      const body = await get<{
        total_searches_left?: number;
        this_month_usage?: number;
        searches_per_month?: number;
        plan_renewal_date?: string;
      }>('/account', {});
      return {
        remaining: body.total_searches_left ?? 0,
        usedThisMonth: body.this_month_usage ?? 0,
        ...(body.searches_per_month !== undefined ? { perMonth: body.searches_per_month } : {}),
        ...(body.plan_renewal_date ? { renewalDate: body.plan_renewal_date } : {}),
      };
    },
  };
}
