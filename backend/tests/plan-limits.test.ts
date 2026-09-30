import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { DEFAULT_PROPERTY_ID, DEMO_PROPERTY, getProperty } from '../lib/properties';
import { newAccount, saveAccount, type Account } from '../lib/billing/accounts';
import { enforceCompCap, EXEMPT_LIMITS, limitsFor, MAX_COMPS } from '../lib/billing/limits';
import { saveMembers } from '../lib/auth/members';
import { HISTORY_KEPT, recentHistory } from '../lib/history';
import { processBundle, type Bundle } from '../lib/ingest';
import { addDays, todayIn } from '../lib/date';
import { requireRole } from '../lib/auth/guard';
import { loadWatchlist, saveWatchlist, trimNoteKey, trimWatchlist, type TrimNote } from '../lib/watchlist';

const h = vi.hoisted(() => ({ store: null as unknown as FileStore, sent: [] as { to: string[]; subject: string; text: string }[], demo: false }));

// One store stands in for both the global store and the hotel's own.
vi.mock('../lib/store', async (orig) => ({
  ...(await orig<typeof import('../lib/store')>()),
  getStore: () => h.store,
  storeFor: () => h.store,
}));
vi.mock('../lib/email/send', () => ({ sendEmail: async (m: { to: string[]; subject: string; text: string }) => void h.sent.push(m) }));
// The real role guard runs, so the limits the routes act on come from the saved account.
vi.mock('../auth', () => ({ auth: async () => ({ user: { id: 'u', email: 'gm@maple.com', role: 'owner', propertyId: 'hotel-a' } }) }));
vi.mock('../lib/demo/context', () => ({
  demoSid: async () => (h.demo ? 'sid' : null),
  requestStore: async () => h.store,
  requestProperty: async () => ({ id: 'hotel-a', city: 'Asheville, NC', timezone: 'America/New_York' }),
}));
vi.mock('../lib/api/property-request', () => ({
  isCollector: () => false,
  propertyFromRequest: async () => ({ ok: true, propertyId: 'hotel-a', property: { city: 'Asheville, NC' }, store: h.store }),
}));

const NOW = new Date('2026-10-01T12:00:00Z');
const on = (plan?: Account['plan']): Account => ({ ...newAccount('hotel-a', NOW), ...(plan && { plan, status: 'active' }) });
const hotels = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Hotel ${i}`, addedAt: new Date(NOW.getTime() + i * 60_000).toISOString() }));
const post = (body: unknown) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  h.store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-limits-')), 'store.json'));
  h.sent = [];
  h.demo = false;
  delete process.env.RESEND_API_KEY;
});

describe('limitsFor', () => {
  it('gives Starter no Bellhop, 4 comps and 90 days; Growth and a trial Bellhop, 8 and a year', () => {
    expect(limitsFor(on('starter'), 'hotel-a')).toEqual({ plan: 'starter', bellhop: false, maxComps: 4, historyDays: 90 });
    expect(limitsFor(on('growth'), 'hotel-a')).toEqual({ plan: 'growth', bellhop: true, maxComps: 8, historyDays: 365 });
    expect(limitsFor(on(), 'hotel-a')).toEqual(limitsFor(on('growth'), 'hotel-a'));
  });

  it('holds the original hotel and the demo to the hard ceiling only', () => {
    for (const id of [DEFAULT_PROPERTY_ID, DEMO_PROPERTY.id]) {
      expect(limitsFor(on('starter'), id)).toEqual({ plan: 'growth', bellhop: true, maxComps: MAX_COMPS, historyDays: 365 });
    }
  });
});

describe('trimWatchlist', () => {
  it('keeps the hotels added first, in their order, and leaves a note of the rest and the cap', async () => {
    const list = hotels(6).reverse(); // stored newest first, to prove order comes from addedAt
    await saveWatchlist(h.store, 'hotel-a', list);
    expect(await trimWatchlist(h.store, 'hotel-a', 4, NOW)).toEqual(['Hotel 5', 'Hotel 4']);
    expect((await loadWatchlist(h.store, 'hotel-a')).map((x) => x.name)).toEqual(['Hotel 3', 'Hotel 2', 'Hotel 1', 'Hotel 0']);
    expect(await h.store.get<TrimNote>(trimNoteKey('hotel-a'))).toEqual({ removed: ['Hotel 5', 'Hotel 4'], max: 4, at: NOW.toISOString() });
  });

  it('does nothing to a list at or under the cap, so a repeat is a no-op', async () => {
    await saveWatchlist(h.store, 'hotel-a', hotels(4));
    expect(await trimWatchlist(h.store, 'hotel-a', 4)).toEqual([]);
    expect(await h.store.get(trimNoteKey('hotel-a'))).toBeNull();
  });

  it('clears the note once the hotel is on a higher cap, and keeps it on the same one', async () => {
    await saveWatchlist(h.store, 'hotel-a', hotels(6));
    await trimWatchlist(h.store, 'hotel-a', 4, NOW);
    await trimWatchlist(h.store, 'hotel-a', 4);
    expect(await h.store.get(trimNoteKey('hotel-a'))).not.toBeNull();
    await trimWatchlist(h.store, 'hotel-a', 8);
    expect(await h.store.get(trimNoteKey('hotel-a'))).toBeNull();
  });
});

describe('enforceCompCap', () => {
  beforeEach(async () => {
    process.env.RESEND_API_KEY = 'test';
    await saveMembers(h.store, [
      { email: 'gm@maple.com', role: 'owner', invitedAt: 'x', propertyId: 'hotel-a' },
      { email: 'fd@maple.com', role: 'viewer', invitedAt: 'x', propertyId: 'hotel-a' },
      { email: 'other@inn.com', role: 'owner', invitedAt: 'x', propertyId: 'hotel-b' },
    ]);
  });

  it("trims to the account's plan and mails only that hotel's owners, once", async () => {
    await saveWatchlist(h.store, 'hotel-a', hotels(8));
    await enforceCompCap(on('starter'), 'hotel-a');
    expect((await loadWatchlist(h.store, 'hotel-a')).length).toBe(4);
    expect(h.sent.map((m) => m.to)).toEqual([['gm@maple.com']]);
    await enforceCompCap(on('starter'), 'hotel-a');
    expect(h.sent.length).toBe(1);
  });

  it('leaves a Growth list of 8 alone and sends nothing', async () => {
    await saveWatchlist(h.store, 'hotel-a', hotels(8));
    await enforceCompCap(on('growth'), 'hotel-a');
    expect((await loadWatchlist(h.store, 'hotel-a')).length).toBe(8);
    expect(h.sent).toEqual([]);
  });

  it('pitches Growth only to a hotel below it', async () => {
    await saveWatchlist(h.store, 'hotel-a', hotels(10));
    await enforceCompCap(on(), 'hotel-a'); // a trial list from before the caps: cut to Growth's 8
    await enforceCompCap(on('starter'), 'hotel-a');
    expect(h.sent.map((m) => m.text.includes('Growth tracks'))).toEqual([false, true]);
  });

  it('never touches the original property or the demo', async () => {
    await saveWatchlist(h.store, DEFAULT_PROPERTY_ID, hotels(30));
    await enforceCompCap(on('starter'), DEFAULT_PROPERTY_ID);
    expect((await loadWatchlist(h.store, DEFAULT_PROPERTY_ID)).length).toBe(30);
  });
});

describe('ingest', () => {
  const property = { ...getProperty('rri-franklin')!, id: 'hotel-a' };
  const bundle = (): Bundle => ({ runAt: NOW.toISOString(), sources: [], propertyId: 'hotel-a' });

  it('holds the watchlist to the plan before the run uses it', async () => {
    await saveAccount(h.store, on('starter'));
    await saveWatchlist(h.store, 'hotel-a', hotels(8));
    await processBundle(bundle(), h.store, NOW, property);
    expect((await loadWatchlist(h.store, 'hotel-a')).length).toBe(4);
  });

  it('still lands the run when the account read fails', async () => {
    const hget = h.store.hget.bind(h.store);
    vi.spyOn(h.store, 'hget').mockImplementation((key, field) =>
      key === 'account:byProperty' ? Promise.reject(new Error('store unreachable')) : hget(key, field),
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await processBundle(bundle(), h.store, NOW, property);
    expect(await h.store.get(`prop:hotel-a:snapshot:latest`)).not.toBeNull();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('comp cap for hotel-a'), expect.any(Error));
    logged.mockRestore();
  });

  it('prunes history with the date list, dropping the oldest day only', async () => {
    const today = todayIn(property.timezone, NOW);
    const dates = Array.from({ length: HISTORY_KEPT }, (_, i) => addDays(today, -1 - i)); // newest first, as stored
    await h.store.set('history:dates', dates);
    for (const d of [dates[0], dates.at(-1)!]) await h.store.hset('history', d, { date: d });
    await processBundle(bundle(), h.store, NOW, property);
    expect(Object.keys(await h.store.hgetall('history')).sort()).toEqual([dates[0], today].sort());
  });
});

describe('recentHistory', () => {
  const rec = (date: string) => ({ date, recommendedStandard: 90, recommendedSuperior: 110, nightScore: 0, topDriver: 'none', recordedAt: date });

  it('returns the days after the cutoff, newest first', async () => {
    for (const d of ['2026-06-01', '2026-09-01', '2026-09-30', '2026-07-03']) await h.store.hset('history', d, rec(d));
    expect((await recentHistory(h.store, '2026-07-03')).map((r) => r.date)).toEqual(['2026-09-30', '2026-09-01']);
  });

  it('forgets pruned days', async () => {
    for (const d of ['2026-09-01', '2026-09-02']) await h.store.hset('history', d, rec(d));
    await h.store.hdel('history', ['2026-09-01']);
    expect((await recentHistory(h.store, '2026-01-01')).map((r) => r.date)).toEqual(['2026-09-02']);
  });
});

describe('routes on Starter', () => {
  beforeEach(async () => {
    await saveAccount(h.store, on('starter'));
  });

  it('Bellhop answers 402', async () => {
    const { POST } = await import('../../frontend/app/api/bellhop/route');
    expect((await POST(post({ messages: [{ role: 'user', text: 'why?' }] }))).status).toBe(402);
  });

  it('the watchlist refuses a fifth competitor with 402, and takes a fourth', async () => {
    const { POST } = await import('../../frontend/app/api/watchlist/route');
    await saveWatchlist(h.store, 'hotel-a', hotels(3));
    expect((await POST(post({ name: 'Fourth Inn', lat: 1, lng: 1 }) as never)).status).toBe(200);
    const refused = await POST(post({ name: 'Fifth Inn', lat: 1, lng: 1 }) as never);
    expect(refused.status).toBe(402);
    expect((await refused.json()).error).toBe('Starter tracks up to 4 competitors, Growth 8.');
  });

  it("Growth's cap is not a payment wall: 400", async () => {
    await saveAccount(h.store, on('growth'));
    const { POST } = await import('../../frontend/app/api/watchlist/route');
    await saveWatchlist(h.store, 'hotel-a', hotels(8));
    expect((await POST(post({ name: 'Ninth Inn', lat: 1, lng: 1 }) as never)).status).toBe(400);
  });
});

describe('the role gate', () => {
  it("hands a route the signed-in hotel's limits", async () => {
    await saveAccount(h.store, on('starter'));
    const gate = await requireRole('viewer');
    expect(gate.ok && gate.limits.plan).toBe('starter');
  });

  it('hands a demo visitor the exempt limits', async () => {
    h.demo = true;
    const gate = await requireRole('manager');
    expect(gate.ok && gate.limits).toEqual(EXEMPT_LIMITS);
  });
});
