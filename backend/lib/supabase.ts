import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Next.js data-caches fetches made inside server components. That once froze
 * an early empty read of snapshot:latest and left the dashboard on "No data
 * yet" forever, so no Supabase call is ever cached.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let admin: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server only — never import from a client component. */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
  return admin;
}
