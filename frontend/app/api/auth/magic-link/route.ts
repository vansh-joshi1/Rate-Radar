import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, sendMagicLink } from '../../../../../backend/auth';
import { isAllowed } from '../../../../../backend/lib/auth/members';
import { getStore } from '../../../../../backend/lib/store';

/** Invite-gated: a link goes only to OWNER_EMAIL or someone on the Team list. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; next?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const store = getStore();
  if (!email || !(await isAllowed(store, email))) {
    return NextResponse.json({ error: 'not invited' }, { status: 403 });
  }
  // Keeps a scripted loop from flooding a member's inbox.
  if ((await store.incr(`magic-link:${email}`, 600)) > 5) {
    return NextResponse.json({ error: 'too many links requested, try again in a few minutes' }, { status: 429 });
  }
  await sendMagicLink(email, req.nextUrl.origin, safeNext(body.next));
  return NextResponse.json({ ok: true });
}
