import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStore, PrefixedStore } from '../../../backend/lib/store';
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
  const existing = (await cookies()).get(DEMO_COOKIE)?.value;
  const sid = !reset && isValidDemoSid(existing) ? existing : newDemoSid();

  const store = new PrefixedStore(getStore(), demoPrefix(sid), DEMO_TTL_SECONDS);
  if (reset || (await sandboxNeedsSeed(store))) {
    // Every seed writes a sandbox's worth of rows to the real database: a loop
    // on this public URL would otherwise fill it.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if ((await getStore().incr(`demo-seed:${ip}`, 3600)) > 20) {
      return new NextResponse('Too many demo sandboxes from here. Try again in an hour.', { status: 429 });
    }
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
