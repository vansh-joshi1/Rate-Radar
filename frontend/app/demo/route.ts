import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStore, prefixed } from '../../../backend/lib/store';
import { DEMO_COOKIE, DEMO_TTL_SECONDS, demoPrefix, isValidDemoSid, newDemoSid } from '../../../backend/lib/demo/session';
import { seedDemoSandbox, sandboxNeedsSeed } from '../../../backend/lib/demo/context';

export const dynamic = 'force-dynamic';

/**
 * Public demo entry. Mints a sandbox, fills it with the invented world, and
 * drops the visitor on the dashboard — no account, no email, no password.
 *
 * The sandbox is a key namespace in the same Redis the real property uses
 * (`demo:{sid}:`), so a demo visitor exercises the genuine route handlers,
 * role guard and store while reaching none of the real hotel's keys. Writes
 * carry a rolling 24h expiry, so the sandbox sweeps itself.
 *
 * `?reset=1` starts a clean sandbox — the way back from a demo the visitor has
 * edited into a mess.
 */
export async function GET(req: Request) {
  const reset = new URL(req.url).searchParams.get('reset') === '1';
  const existing = cookies().get(DEMO_COOKIE)?.value;
  const sid = !reset && isValidDemoSid(existing) ? existing : newDemoSid();

  const store = prefixed(getStore(), demoPrefix(sid), DEMO_TTL_SECONDS);
  if (reset || (await sandboxNeedsSeed(store))) {
    await seedDemoSandbox(store);
  }

  const res = NextResponse.redirect(new URL('/overview', req.url));
  res.cookies.set(DEMO_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_TTL_SECONDS,
  });
  return res;
}
