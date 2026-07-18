import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';

/**
 * Gate everything except the public marketing/auth surface behind a NextAuth
 * session (JWT cookie, verified at the edge). API routes get a JSON 401;
 * pages get bounced to /login with the intended destination in ?next.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (req.auth) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const next = req.nextUrl.pathname + req.nextUrl.search;
  const login = new URL('/login', req.url);
  if (next && next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    // Everything except: public marketing/auth pages ($ = the landing page at "/"),
    // NextAuth's own endpoints, ingest (bearer-token protected), the v1 API
    // (its own key auth), health, watchlist (self-auths: session OR ingest
    // secret — the collector calls it), static assets
    '/((?!$|login|signup|onboarding|api/auth|api/ingest|api/v1|api/health|api/watchlist|api/cron|_next/static|_next/image|favicon.ico|robots.txt|originid.global.js).*)',
  ],
};
