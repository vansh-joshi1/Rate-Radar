import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, verifySession } from './lib/auth';

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: [
    // Everything except: public marketing/auth pages ($ = the landing page at "/"),
    // login + logout endpoints, ingest (bearer-token protected), the v1 API
    // (its own key auth in lib/api/auth.ts), static assets
    '/((?!$|login|signup|onboarding|api/login|api/logout|api/ingest|api/v1|api/health|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
