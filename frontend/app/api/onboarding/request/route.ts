import { NextResponse, type NextRequest } from 'next/server';
import { createPasswordUser, deleteUserById } from '../../../../../backend/auth';
import { AccessRequestBody, saveAccessRequest } from '../../../../../backend/lib/access-requests';
import { getStore } from '../../../../../backend/lib/store';

export const dynamic = 'force-dynamic';

/**
 * The end of /onboarding: save the property details for review and create the
 * email + password account the owner will sign in with once verified. Public
 * (there is no session yet), so it is throttled per IP. The account grants
 * nothing on its own: access comes from being added to the Team.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const store = getStore();
  if ((await store.incr(`access-request:${ip}`, 3600)) > 5) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }

  const parsed = AccessRequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { password, ...details } = parsed.data;

  const userId = await createPasswordUser(details.email, password);
  if (!userId) return NextResponse.json({ error: 'account exists' }, { status: 409 });

  try {
    await saveAccessRequest(store, { ...details, status: 'pending', submittedAt: new Date().toISOString() });
  } catch (e) {
    // No request on file means nobody will ever review it: don't leave an orphan account behind.
    await deleteUserById(userId).catch(() => {});
    throw e;
  }
  return NextResponse.json({ ok: true });
}
