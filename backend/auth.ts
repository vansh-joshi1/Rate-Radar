import * as React from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getStore } from './lib/store';
import { noStoreFetch, supabaseAdmin } from './lib/supabase';
import { membershipFor, ownerEmail } from './lib/auth/members';
import { DEFAULT_PROPERTY_ID } from './lib/properties';
import type { Role } from './lib/auth/roles';
import { signInEmail } from './lib/email/messages';

/**
 * Supabase Auth, session in SSR cookies (refreshed by the middleware).
 *
 * Three ways in:
 *  - shared site password → a session for one shared "front desk" user, owner role
 *  - email magic link → INVITE-GATED: only OWNER_EMAIL and addresses on the
 *    Team list get a link. We mint the link with the admin API and send it
 *    ourselves, so it carries the branded template and the gate lives here,
 *    not in Supabase's dashboard.
 *  - email + password → the account an /onboarding access request creates.
 *    Having the account is not access: until the email is on the Team list,
 *    /api/auth/sign-in signs it straight back out ("still under review").
 *
 * Roles are NOT stored in the token: they are read from the Team list on every
 * request, so removing someone from the team signs them out immediately.
 */

/**
 * React `cache` exists only in Next's server build of React. Plain React 18
 * (tests, scripts) lacks it, and there memoizing per render is moot anyway.
 */
const perRender: <F extends (...args: never[]) => unknown>(fn: F) => F =
  (React as { cache?: <F>(fn: F) => F }).cache ?? ((fn) => fn);

/** The shared-password identity. Never emailed; `.invalid` is reserved and can't receive mail. */
export const SHARED_LOGIN_EMAIL = 'front-desk@rate-radar.invalid';
const SHARED_NAME = 'Front desk (shared password)';

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  /** The one hotel this person may see. Every read and write is scoped to it. */
  propertyId: string;
  /** OWNER_EMAIL: may approve access requests and see every property (/admin). */
  isAdmin: boolean;
}

function authEnv(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** False in local dev without Supabase, where there are no sessions and the original property is shown. */
export function authConfigured(): boolean {
  return authEnv() !== null;
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

/**
 * The signed-in user, or null. Same shape the call sites used under Auth.js.
 *
 * Memoized per server render (`perRender`): the layout, the page and
 * every `requestStore()`/`requestProperty()` inside them ask, and each ask is a
 * Supabase round trip plus two store reads. Route handlers are not memoized by
 * `cache` and simply call through.
 */
export const auth = perRender(async (): Promise<{ user: SessionUser } | null> => {
  if (!authEnv()) return null;
  const {
    data: { user },
  } = await supabaseAuth().auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return null;
  // The shared front-desk password belongs to the original property only.
  if (email === SHARED_LOGIN_EMAIL) {
    return {
      user: { id: user.id, name: SHARED_NAME, email: null, role: 'owner', propertyId: DEFAULT_PROPERTY_ID, isAdmin: false },
    };
  }
  const membership = await membershipFor(getStore(), email);
  if (!membership) return null;
  return {
    user: {
      id: user.id,
      name: (user.user_metadata?.name as string | undefined) ?? null,
      email,
      ...membership,
      isAdmin: email === ownerEmail(),
    },
  };
});

/** One-time magic-link token hash for `email`, creating the Supabase user on first use. */
async function magicLinkToken(email: string, name?: string): Promise<string> {
  const admin = supabaseAdmin().auth.admin;
  // Fails harmlessly when the user already exists; any real problem surfaces in generateLink.
  await admin.createUser({ email, email_confirm: true, user_metadata: name ? { name } : undefined });
  const { data, error } = await admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`Supabase generateLink: ${error.message}`);
  return data.properties.hashed_token;
}

/**
 * Create the email + password account an access request signs in with. Supabase
 * hashes the password; we never store it. Returns the user id, or null when the
 * email already has an account (a teammate, or a repeat request).
 */
export async function createPasswordUser(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.code === 'email_exists' || /already/i.test(error.message)) return null;
    throw new Error(`Supabase createUser: ${error.message}`);
  }
  return data.user.id;
}

export async function deleteUserById(id: string): Promise<void> {
  await supabaseAdmin().auth.admin.deleteUser(id);
}

/** Email + password → session cookies on the current response. */
export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabaseAuth().auth.signInWithPassword({ email, password });
  return !error;
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

/**
 * Kill a removed member's Supabase sessions by deleting their auth user. The
 * middleware only checks "has a session", and refresh tokens never expire, so
 * without this a removed member keeps read access to middleware-gated routes.
 * Their current access token still works until it expires (≤1h).
 */
export async function revokeUser(email: string): Promise<void> {
  const admin = supabaseAdmin().auth.admin;
  // ponytail: first 1000 users only; page through listUsers if a team ever gets near that.
  const { data, error } = await admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Supabase listUsers: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (user) await admin.deleteUser(user.id);
}

/** Only same-site paths survive as a post-sign-in destination — no open redirects. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/overview';
}
