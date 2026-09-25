import { describe, it, expect } from 'vitest';
import { createSerpApiClient } from '../collector/sources/serpapi';

/** Records the URL it was called with and replays a canned body. */
function stubFetch(body: unknown, init: { status?: number } = {}) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    return {
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      json: async () => body,
    } as Response;
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('searchProperties', () => {
  it('asks the google_hotels engine for the given query and dates', async () => {
    const { impl, calls } = stubFetch({ properties: [{ name: 'Comfort Inn Franklin' }] });
    const client = createSerpApiClient('KEY123', impl);

    const properties = await client.searchProperties('Franklin, Tennessee', '2026-08-02', '2026-08-03');

    expect(properties).toEqual([{ name: 'Comfort Inn Franklin' }]);
    const url = new URL(calls[0]);
    expect(url.origin + url.pathname).toBe('https://serpapi.com/search');
    expect(url.searchParams.get('engine')).toBe('google_hotels');
    expect(url.searchParams.get('api_key')).toBe('KEY123');
    expect(url.searchParams.get('q')).toBe('Franklin, Tennessee');
    expect(url.searchParams.get('check_in_date')).toBe('2026-08-02');
    expect(url.searchParams.get('check_out_date')).toBe('2026-08-03');
    expect(url.searchParams.get('currency')).toBe('USD');
  });

  it('returns an empty list when the engine finds nothing', async () => {
    const { impl } = stubFetch({});
    const client = createSerpApiClient('KEY123', impl);
    expect(await client.searchProperties('Nowhere', '2026-08-02', '2026-08-03')).toEqual([]);
  });

  it('treats an error key in a 200 body as a failure', async () => {
    const { impl } = stubFetch({ error: "Google Hotels hasn't returned any results for this query." });
    const client = createSerpApiClient('KEY123', impl);

    await expect(client.searchProperties('Franklin', '2026-08-02', '2026-08-03')).rejects.toThrow(
      /hasn't returned any results/
    );
  });

  it('surfaces an exhausted quota as a distinguishable error', async () => {
    const { impl } = stubFetch({ error: 'Your account has run out of searches.' }, { status: 401 });
    const client = createSerpApiClient('KEY123', impl);

    await expect(client.searchProperties('Franklin', '2026-08-02', '2026-08-03')).rejects.toThrow(
      /run out of searches/
    );
  });
});

describe('propertyDetails', () => {
  it('passes the property token through and returns the detail body', async () => {
    const { impl, calls } = stubFetch({ name: 'Red Roof Inn Franklin', featured_prices: [] });
    const client = createSerpApiClient('KEY123', impl);

    const details = await client.propertyDetails('TOKEN9', 'Red Roof Inn Franklin TN', '2026-08-02', '2026-08-03');

    expect(details.name).toBe('Red Roof Inn Franklin');
    expect(new URL(calls[0]).searchParams.get('property_token')).toBe('TOKEN9');
  });
});

describe('accountQuota', () => {
  it('reads the searches left and the renewal date from the account endpoint', async () => {
    const { impl, calls } = stubFetch({
      total_searches_left: 231,
      this_month_usage: 19,
      searches_per_month: 250,
      plan_renewal_date: '2026-09-23',
    });
    const client = createSerpApiClient('KEY123', impl);

    expect(await client.accountQuota()).toEqual({
      remaining: 231,
      usedThisMonth: 19,
      perMonth: 250,
      renewalDate: '2026-09-23',
    });
    expect(new URL(calls[0]).pathname).toBe('/account');
  });

  it('omits the renewal date rather than inventing one when the plan has none', async () => {
    const { impl } = stubFetch({ total_searches_left: 100 });
    const client = createSerpApiClient('KEY123', impl);

    const quota = await client.accountQuota();
    expect(quota.renewalDate).toBeUndefined();
    expect(quota.remaining).toBe(100);
  });

  it('is not itself counted against the quota, so it never blocks a run', async () => {
    const { impl } = stubFetch({ error: 'temporarily unavailable' }, { status: 503 });
    const client = createSerpApiClient('KEY123', impl);

    // Unknown quota must not be mistaken for an exhausted one.
    await expect(client.accountQuota()).rejects.toThrow(/temporarily unavailable/);
  });
});

describe('searchProperties on a query naming one hotel', () => {
  it('returns that hotel page as a one-item list', async () => {
    const page = { name: 'Red Roof Inn Nashville - Franklin', property_token: 'tok', featured_prices: [] };
    const { impl } = stubFetch(page);
    const client = createSerpApiClient('KEY123', impl);
    expect(await client.searchProperties('Red Roof Inn Franklin', '2026-08-02', '2026-08-03')).toEqual([page]);
  });
});
