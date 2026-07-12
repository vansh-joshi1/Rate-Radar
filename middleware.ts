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
    // Everything except: login page + endpoint, ingest (bearer-token protected), static assets
    '/((?!login|api/login|api/ingest|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
