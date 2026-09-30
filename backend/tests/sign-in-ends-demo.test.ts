import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEMO_COOKIE } from '../lib/demo/session';

// A leftover demo cookie outranks a real session on every page, so signing in
// must drop it — otherwise the front desk lands in Harbor Pine Inn.
const h = vi.hoisted(() => ({ sets: [] as { name: string; value: string; options?: { path?: string; maxAge?: number } }[], error: null as unknown }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: (name: string, value: string, options?: object) => h.sets.push({ name, value, options }) }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { signInWithPassword: async () => ({ error: h.error }), verifyOtp: async () => ({ error: h.error }) } }),
}));

import { signInWithPassword, verifyMagicLink } from '../auth';

const cleared = () => h.sets.some((c) => c.name === DEMO_COOKIE && c.value === '' && c.options?.path === '/' && c.options?.maxAge === 0);

describe('signing in ends any demo sandbox', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    h.sets = [];
    h.error = null;
  });

  it('clears the demo cookie on a password sign-in', async () => {
    expect(await signInWithPassword('a@b.com', 'pw')).toBe(true);
    expect(cleared()).toBe(true);
  });

  it('clears it on a magic link (and so the shared password)', async () => {
    expect(await verifyMagicLink('hash')).toBe(true);
    expect(cleared()).toBe(true);
  });

  it('leaves the demo alone when sign-in fails', async () => {
    h.error = new Error('nope');
    expect(await signInWithPassword('a@b.com', 'bad')).toBe(false);
    expect(cleared()).toBe(false);
  });
});
