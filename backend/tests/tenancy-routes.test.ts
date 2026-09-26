import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { listMembers, saveMembers, type Member } from '../lib/auth/members';
import { addProperty, listProperties } from '../lib/properties';
import { saveAccessRequest, getAccessRequest, type AccessRequest } from '../lib/access-requests';
import { scoreEvent, nightScore } from '../lib/scoring/score';
import { UNKNOWN_LOCAL_VENUE_CAPACITY } from '../collector/sources/ticketmaster';

/**
 * The team and approve routes, with the session faked. Who is asking is the
 * whole point: each test sets the signed-in member and checks what they reach.
 */
const h = vi.hoisted(() => ({
  store: null as unknown as FileStore,
  user: { email: 'gm@maple.com', role: 'owner', propertyId: 'maple-lodge', isAdmin: false },
}));

vi.mock('../lib/store', async (orig) => ({ ...(await orig<typeof import('../lib/store')>()), getStore: () => h.store }));
vi.mock('../auth', () => ({ auth: async () => ({ user: { id: 'u', name: null, ...h.user } }), revokeUser: async () => {} }));
vi.mock('../lib/auth/guard', () => ({ requireRole: async () => ({ ok: true, role: 'owner' }) }));
vi.mock('../lib/demo/context', () => ({ demoSid: () => null, requestStore: async () => h.store, demoRefusal: () => null }));
vi.mock('../lib/geo', () => ({
  locateAddress: async () => ({ lat: 35.59, lng: -82.55, city: 'Asheville, NC', timezone: 'America/New_York' }),
}));

const members = (): Member[] => [
  { email: 'desk@rri.com', role: 'manager', invitedAt: 'x' }, // original property, from before propertyId existed
  { email: 'gm@maple.com', role: 'owner', invitedAt: 'x', propertyId: 'maple-lodge' },
  { email: 'fd@maple.com', role: 'viewer', invitedAt: 'x', propertyId: 'maple-lodge' },
];
const json = (method: string, body: unknown) =>
  new Request('https://x/api', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  h.store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-routes-')), 'store.json'));
  h.user = { email: 'gm@maple.com', role: 'owner', propertyId: 'maple-lodge', isAdmin: false };
  process.env.OWNER_EMAIL = 'vansh@rri.com';
  delete process.env.RESEND_API_KEY;
  await saveMembers(h.store, members());
});

describe('team route', () => {
  it("lists only the caller's hotel", async () => {
    const { GET } = await import('../../frontend/app/api/members/route');
    const body = await (await GET()).json();
    expect(body.members.map((m: Member) => m.email)).toEqual(['gm@maple.com', 'fd@maple.com']);
    expect(body.ownerEmail).toBeNull();
  });

  it("cannot remove or claim another hotel's member", async () => {
    const { DELETE, POST } = await import('../../frontend/app/api/members/route');
    expect((await DELETE(json('DELETE', { email: 'desk@rri.com' }) as never)).status).toBe(404);
    expect((await POST(json('POST', { email: 'desk@rri.com', role: 'viewer' }) as never)).status).toBe(409);
    expect((await listMembers(h.store)).length).toBe(3);
  });

  it('refuses to remove the last owner, allows removing anyone else', async () => {
    const { DELETE } = await import('../../frontend/app/api/members/route');
    expect((await DELETE(json('DELETE', { email: 'gm@maple.com' }) as never)).status).toBe(400);
    expect((await DELETE(json('DELETE', { email: 'fd@maple.com' }) as never)).status).toBe(200);
    expect((await listMembers(h.store)).map((m) => m.email)).toEqual(['desk@rri.com', 'gm@maple.com']);
  });
});

describe('approve route', () => {
  const request: AccessRequest = {
    email: 'new@pine.com', phone: '5555555555', name: 'Pine Court', address: '9 Elm St, Asheville, NC', rooms: 30,
    type: 'Motel', token: null, channels: [], listings: { direct: '', expedia: '', booking: '' },
    roomTypes: [{ name: 'King', tier: 'standard', price: 120 }], competitors: ['Elm Inn'],
    status: 'pending', submittedAt: '2026-09-25T00:00:00Z',
  };

  beforeEach(() => {
    h.user = { email: 'vansh@rri.com', role: 'owner', propertyId: 'rri-franklin', isAdmin: true };
  });

  it('only OWNER_EMAIL may approve', async () => {
    h.user = { ...h.user, email: 'gm@maple.com', isAdmin: false };
    const { POST } = await import('../../frontend/app/api/admin/approve/route');
    await saveAccessRequest(h.store, request);
    expect((await POST(json('POST', { email: request.email }) as never)).status).toBe(403);
  });

  it('a retry after a partial failure finishes the same hotel instead of making a second', async () => {
    const { POST } = await import('../../frontend/app/api/admin/approve/route');
    // First attempt got as far as claiming the id and registering the property, then failed.
    await saveAccessRequest(h.store, { ...request, propertyId: 'pine-court' });
    await addProperty(h.store, { id: 'pine-court', name: 'Pine Court', city: 'x', timezone: 'x', lat: 0, lng: 0, totalRooms: 30 });

    const res = await POST(json('POST', { email: request.email, airport: 'avl' }) as never);
    expect(res.status).toBe(200);
    expect((await listProperties(h.store)).filter((p) => p.name === 'Pine Court').map((p) => p.id)).toEqual(['pine-court']);
    expect((await listMembers(h.store)).find((m) => m.email === request.email)).toMatchObject({ role: 'owner', propertyId: 'pine-court' });
    expect((await getAccessRequest(h.store, request.email))?.status).toBe('approved');
    expect((await POST(json('POST', { email: request.email }) as never)).status).toBe(409);
  });

  it('refuses an email that already belongs to a team', async () => {
    const { POST } = await import('../../frontend/app/api/admin/approve/route');
    await saveAccessRequest(h.store, { ...request, email: 'desk@rri.com' });
    expect((await POST(json('POST', { email: 'desk@rri.com' }) as never)).status).toBe(409);
  });
});

describe('area events', () => {
  it("a weekend full of small local shows stays a minor signal, not 'major' demand", () => {
    const saturday = '2026-09-26';
    const gigs = Array.from({ length: 25 }, (_, i) =>
      scoreEvent({
        id: `tm:${i}`, name: `Band ${i}`, date: saturday, venue: `Club ${i}`, capacity: UNKNOWN_LOCAL_VENUE_CAPACITY,
        kind: 'concert', isTouring: true, source: 'ticketmaster',
      })
    );
    expect(nightScore(gigs)).toBeLessThan(40);
  });
});
