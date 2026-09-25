import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getStore } from './lib/store';
import { noStoreFetch, supabaseAdmin } from './lib/supabase';
import { roleFor } from './lib/auth/members';
import type { Role } from './lib/auth/roles';
import { signInEmail } from './lib/email/messages';

/**
 * Supabase Auth, session in SSR cookies (refreshed by the middleware).
 *
 * Two ways in:
 *  - shared site password → a session for one shared "front desk" user, owner role
 *  - email magic link → INVITE-GATED: only OWNER_EMAIL and addresses on the
 *    Team list get a link. We mint the link with the admin API and send it
 *    ourselves, so it carries the branded template and the gate lives here,
 *    not in Supabase's dashboard.
 *
 * Roles are NOT stored in the token: they are read from the Team list on every
 * request, so removing someone from the team signs them out immediately.
 */

/** The shared-password identity. Never emailed; `.invalid` is reserved and can't receive mail. */
export const SHARED_LOGIN_EMAIL = 'front-desk@rate-radar.invalid';
const SHARED_NAME = 'Front desk (shared password)';

export interface SessionUser {
  name: string | null;
  email: string | null;
  role: Role;
}

function authEnv(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Cookie-bound Supabase client for the current request (route handlers + server components). */
export function supabaseAuth() {
  const env = authEnv();
  if (!env) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  const jar = cookies();
  return createServerClient(env.url, env.anonKey, {
    global: { fetch: noStoreFetch },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server components can't write cookies; the middleware refreshes them instead.
        }
      },
    },
  });
}

/** The signed-in user, or null. Same shape the call sites used under Auth.js. */
export async function auth(): Promise<{ user: SessionUser } | null> {
  if (!authEnv()) return null;
  const {
    data: { user },
  } = await supabaseAuth().auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;
  if (email === SHARED_LOGIN_EMAIL) return { user: { name: SHARED_NAME, email: null, role: 'owner' } };
  const role = await roleFor(getStore(), email);
  if (!role) return null;
  return { user: { name: (user?.user_metadata?.name as string | undefined) ?? null, email, role } };
}

/** One-time magic-link token hash for `email`, creating the Supabase user on first use. */
async function magicLinkToken(email: string, name?: string): Promise<string> {
  const admin = supabaseAdmin().auth.admin;
  // Fails harmlessly when the user already exists; any real problem surfaces in generateLink.
  await admin.createUser({ email, email_confirm: true, user_metadata: name ? { name } : undefined });
  const { data, error } = await admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`Supabase generateLink: ${error.message}`);
  return data.properties.hashed_token;
}

/** Exchange a token hash for session cookies on the current response. */
export async function verifyMagicLink(tokenHash: string): Promise<boolean> {
  const { error } = await supabaseAuth().auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  return !error;
}

/** Sign the current request in as the shared front-desk identity. Caller has checked the password. */
export async function startSharedSession(): Promise<boolean> {
  return verifyMagicLink(await magicLinkToken(SHARED_LOGIN_EMAIL, SHARED_NAME));
}

/** Email a branded sign-in link that lands on /auth/confirm. Caller has checked the invite list. */
export async function sendMagicLink(email: string, origin: string, next: string): Promise<void> {
  const url = new URL('/auth/confirm', origin);
  url.searchParams.set('token_hash', await magicLinkToken(email));
  url.searchParams.set('next', next);
  const { subject, html, text } = signInEmail({ url: url.toString(), email });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Rate Radar <onboarding@resend.dev>', to: email, subject, html, text }),
  });
  if (!res.ok) throw new Error('Resend error: ' + JSON.stringify(await res.json()));
}

/** Only same-site paths survive as a post-sign-in destination — no open redirects. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/overview';
}
