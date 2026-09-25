import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE, isValidDemoSid } from '../backend/lib/demo/session';

/**
 * Gate everything except the public marketing/auth surface behind a Supabase
 * session (SSR cookies, refreshed here on every request). API routes get a
 * JSON 401; pages get bounced to /login with the intended destination in ?next.
 *
 * This only answers "is someone signed in?". Whether they are still on the
 * team, and in what role, is checked server-side by auth() / requireRole().
 */
export default async function middleware(req: NextRequest) {
  // A demo sandbox is a second, weaker way past this gate. It admits nobody to
  // the real property: every read and write on a demo request is namespaced to
  // the sandbox downstream, so the worst a forged cookie buys is a sandbox of
  // invented hotels. Validated here anyway — the value becomes a storage key.
  if (isValidDemoSid(req.cookies.get(DEMO_COOKIE)?.value)) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list, headers) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => res.headers.set(k, v));
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) return res;
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const next = req.nextUrl.pathname + req.nextUrl.search;
  const login = new URL('/login', req.url);
  if (next && next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except: public marketing/auth pages ($ = the landing page at "/"),
    // the demo entry/exit routes (they mint the cookie this gate looks for),
    // our sign-in endpoints (api/auth) and the magic-link landing (auth/confirm),
    // ingest (bearer-token protected), the v1 API
    // (its own key auth), health, watchlist (self-auths: session OR ingest
    // secret — the collector calls it), onboarding discovery (public, capped),
    // static assets, and the favicon + link
    // preview image, which unfurlers and signed-out tabs must be able to fetch,
    // the landing page's demo video, the PostHog proxy (signed-out pages send events too), and the email mark, which inboxes fetch with no session
    '/((?!$|demo|login|signup|onboarding|auth/confirm|api/auth|api/ingest|api/v1|api/health|api/watchlist|api/cron|api/onboarding|_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|email-mark.png|robots.txt|originid.global.js|rate-radar-demo.mp4|ingest).*)',
  ],
};
