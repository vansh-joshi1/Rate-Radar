import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { auth } from '../../../../../backend/auth';
import { demoRefusal, demoSid } from '../../../../../backend/lib/demo/context';
import { requireRole } from '../../../../../backend/lib/auth/guard';
import { getStore, storeFor } from '../../../../../backend/lib/store';
import { getAccessRequest, saveAccessRequest } from '../../../../../backend/lib/access-requests';
import { listMembers, ownerEmail, saveMembers } from '../../../../../backend/lib/auth/members';
import { addProperty, DEMO_PROPERTY, listProperties, loadProperty, newPropertyId, type Property } from '../../../../../backend/lib/properties';
import { saveWatchlist } from '../../../../../backend/lib/watchlist';
import { baselineFromRooms, saveRatesConfig } from '../../../../../backend/lib/rates-config';
import { locateAddress } from '../../../../../backend/lib/geo';
import { verifiedEmail } from '../../../../../backend/lib/email/messages';

export const dynamic = 'force-dynamic';

/**
 * POST { email, airport? } — approve an access request (OWNER_EMAIL only).
 *
 * Creates the hotel's property, seeds its competitor watchlist and baseline
 * rates from what onboarding collected, makes the requester the owner of that
 * property's team, and emails them. The account itself already exists: it was
 * created at /onboarding and could not sign in until now.
 *
 * Order matters. The property is registered only after its store is seeded, so
 * the collector never picks up a hotel with no competitors to price, and the
 * member is added last, so nobody can sign in to a half-made property. The id
 * is written onto the request first, so a failed approval can simply be retried.
 */
export async function POST(req: NextRequest) {
  if (demoSid()) return demoRefusal('Approving access requests is turned off in the demo.');
  const gate = await requireRole('owner');
  if (!gate.ok) return gate.response;
  // Owner of a hotel is not enough: approving creates hotels, so it is OWNER_EMAIL's alone.
  const session = await auth();
  if (!session?.user.isAdmin) return NextResponse.json({ error: 'only the Rate Radar owner can approve requests' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; airport?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const airport = body.airport?.trim().toUpperCase() || undefined;
  if (airport && !/^[A-Z0-9]{3,4}$/.test(airport)) {
    return NextResponse.json({ error: 'airport must be a 3-letter code like BNA' }, { status: 400 });
  }

  const store = getStore();
  const request = await getAccessRequest(store, email);
  if (!request) return NextResponse.json({ error: 'no access request for that email' }, { status: 404 });
  if (request.status === 'approved') return NextResponse.json({ error: 'already approved' }, { status: 409 });

  // A retry after a partial failure resumes the hotel the first attempt started.
  const resuming = request.propertyId;
  const members = await listMembers(store);
  const member = members.find((m) => m.email === email);
  if (email === ownerEmail() || (member && (!resuming || member.propertyId !== resuming))) {
    return NextResponse.json({ error: 'that email is already on a team' }, { status: 409 });
  }

  const located = await locateAddress(request.address);
  if (!located) {
    return NextResponse.json(
      { error: `couldn't place "${request.address}" on the map. Check the address with the hotel and ask them to request again.` },
      { status: 422 }
    );
  }

  const existing = resuming ? await loadProperty(store, resuming) : undefined;
  const id = resuming ?? newPropertyId(request.name, [...(await listProperties(store)).map((p) => p.id), DEMO_PROPERTY.id]);
  // Claimed before anything else is written: every later step is safe to repeat under this id.
  // ponytail: two approvals of one request in the same instant can still both claim; the button disables while one runs.
  if (!resuming) await saveAccessRequest(store, { ...request, propertyId: id });

  const property: Property = {
    id,
    name: request.name,
    city: located.city,
    timezone: located.timezone,
    lat: located.lat,
    lng: located.lng,
    totalRooms: request.rooms,
    collect: {
      serpQuery: `hotels near ${request.address}`,
      ...(request.token ? { propertyToken: request.token } : {}),
      ...(airport ? { airport } : {}),
      superiorRooms: request.roomTypes.filter((r) => r.tier === 'superior').map((r) => r.name),
    },
  };

  const now = new Date().toISOString();
  const tenant = storeFor(id);
  await saveWatchlist(tenant, id, request.competitors.map((name) => ({ name, addedAt: now })));
  await saveRatesConfig(tenant, id, baselineFromRooms(request.roomTypes));
  if (!existing) await addProperty(store, property);
  if (!member) await saveMembers(store, [...members, { email, role: 'owner', invitedAt: now, propertyId: id }]);
  await saveAccessRequest(store, { ...request, propertyId: id, status: 'approved' });

  // The approval stands even if the email fails; the page says so, and the owner can be told directly.
  const emailed = await sendVerified(email, property.name, new URL('/login', req.url).toString()).catch((err) => {
    console.error('[approve] verified email failed:', err);
    return false;
  });
  return NextResponse.json({ ok: true, property, emailed });
}

async function sendVerified(to: string, hotelName: string, loginUrl: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const { subject, html, text } = verifiedEmail({ loginUrl, hotelName });
  const { error } = await new Resend(key).emails.send({ from: 'Rate Radar <onboarding@resend.dev>', to, subject, html, text });
  if (error) throw new Error(`Resend: ${error.message}`);
  return true;
}
