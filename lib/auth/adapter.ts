import type { Adapter, AdapterUser, VerificationToken } from 'next-auth/adapters';
import type { Store } from '../store';

/**
 * Minimal Auth.js adapter over our own Store (Upstash in prod, JSON file in
 * dev) — no extra database. With JWT sessions, Auth.js only needs users and
 * one-time verification tokens (for email magic links) persisted; sessions
 * live in the signed cookie.
 *
 * Layout:
 *   auth:users        hash  id → AdapterUser
 *   auth:email-index  hash  lowercased email → id
 *   auth:vt:{identifier}:{token}  kv, TTL'd — one-time magic-link tokens
 */

const USERS = 'auth:users';
const EMAIL_INDEX = 'auth:email-index';
const vtKey = (identifier: string, token: string) => `auth:vt:${identifier.toLowerCase()}:${token}`;

export function storeAdapter(store: Store): Adapter {
  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      const created: AdapterUser = { ...user, id, email: user.email.toLowerCase() };
      await store.hset(USERS, id, created);
      await store.hset(EMAIL_INDEX, created.email, id);
      return created;
    },

    async getUser(id) {
      return (await store.hget<AdapterUser>(USERS, id)) ?? null;
    },

    async getUserByEmail(email) {
      const id = await store.hget<string>(EMAIL_INDEX, email.toLowerCase());
      if (!id) return null;
      return (await store.hget<AdapterUser>(USERS, id)) ?? null;
    },

    // No OAuth providers wired yet — accounts are never linked.
    async getUserByAccount() {
      return null;
    },
    async linkAccount() {
      return undefined;
    },

    async updateUser(partial) {
      const existing = await store.hget<AdapterUser>(USERS, partial.id);
      const merged = { ...existing, ...partial } as AdapterUser;
      await store.hset(USERS, partial.id, merged);
      return merged;
    },

    async createVerificationToken(vt) {
      // 24h TTL (Upstash honors it; the file store falls back to the expiry check below)
      await store.set(vtKey(vt.identifier, vt.token), { ...vt, expires: vt.expires.toISOString() }, 24 * 3600);
      return vt;
    },

    async useVerificationToken({ identifier, token }) {
      const key = vtKey(identifier, token);
      const raw = await store.get<{ identifier: string; token: string; expires: string }>(key);
      if (!raw) return null;
      await store.del(key); // one-time use
      const vt: VerificationToken = { identifier: raw.identifier, token: raw.token, expires: new Date(raw.expires) };
      return vt.expires > new Date() ? vt : null;
    },
  };
}
