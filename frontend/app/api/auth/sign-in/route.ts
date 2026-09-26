import { NextResponse, type NextRequest } from 'next/server';
import { signInWithPassword, supabaseAuth } from '../../../../../backend/auth';
import { getAccessRequest } from '../../../../../backend/lib/access-requests';
import { isAllowed } from '../../../../../backend/lib/auth/members';
import { getStore } from '../../../../../backend/lib/store';

/**
 * Email + password sign-in. A correct password is not enough: the email must
 * be on the Team list too. A pending access request gets told so, and the
 * session Supabase just issued is ended so the middleware never sees it.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!email || !password) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const store = getStore();
  if ((await store.incr(`sign-in:${ip}:${Math.floor(Date.now() / 60_000)}`, 90)) > 10) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  }

  if (!(await signInWithPassword(email, password))) {
    return NextResponse.json({ error: 'wrong email or password' }, { status: 401 });
  }
  if (await isAllowed(store, email)) return NextResponse.json({ ok: true });

  await supabaseAuth().auth.signOut();
  const request = await getAccessRequest(store, email);
  return NextResponse.json({ error: request ? 'pending' : 'not invited' }, { status: 403 });
}
