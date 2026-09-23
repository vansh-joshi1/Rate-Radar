import { NextResponse } from 'next/server';
import { DEMO_COOKIE } from '../../../lib/demo/session';

export const dynamic = 'force-dynamic';

/**
 * Leave the demo. Drops the cookie and returns to the landing page; the
 * sandbox's keys are left to their own expiry rather than deleted, so a
 * visitor who exits by accident can re-enter and find their edits intact.
 */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(DEMO_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
