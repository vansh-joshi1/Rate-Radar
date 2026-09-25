import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin, supabaseConfigured } from './supabase';

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  lpush(key: string, value: unknown): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  /** Atomic counter with TTL set on first increment — used for rate limiting. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
  /** Put a time limit on an existing key, whatever its type. */
  expire(key: string, ttlSeconds: number): Promise<void>;
}

/** Supabase Postgres: one `kv` table plus RPCs for the atomic ops (supabase/migrations/0001_kv.sql). */
export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  private static expiry(ttlSeconds?: number): string | null {
    return ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(`Supabase ${fn}: ${error.message}`);
    return data as T;
  }

  private static check(op: string, error: { message: string } | null): void {
    if (error) throw new Error(`Supabase ${op}: ${error.message}`);
  }

  async get<T>(key: string): Promise<T | null> {
    const { data, error } = await this.db
      .from('kv')
      .select('value')
      .eq('key', key)
      .or(`expires_at.is.null,expires_at.gt."${new Date().toISOString()}"`)
      .maybeSingle();
    SupabaseStore.check('get', error);
    return (data?.value as T) ?? null;
  }
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const { error } = await this.db.from('kv').upsert({ key, value, expires_at: SupabaseStore.expiry(ttlSeconds) });
    SupabaseStore.check('set', error);
  }
  async hget<T>(key: string, field: string): Promise<T | null> {
    return (await this.rpc<T | null>('kv_hget', { k: key, f: field })) ?? null;
  }
  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.rpc('kv_hset', { k: key, f: field, v: value });
  }
  async lpush(key: string, value: unknown): Promise<void> {
    await this.rpc('kv_lpush', { k: key, v: value });
  }
  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    return this.rpc<T[]>('kv_lrange', { k: key, start, stop });
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    return Number(await this.rpc('kv_incr', { k: key, ttl: ttlSeconds }));
  }
  async del(key: string): Promise<void> {
    const { error } = await this.db.from('kv').delete().eq('key', key);
    SupabaseStore.check('del', error);
  }
  async expire(key: string, ttlSeconds: number): Promise<void> {
    const { error } = await this.db.from('kv').update({ expires_at: SupabaseStore.expiry(ttlSeconds) }).eq('key', key);
    SupabaseStore.check('expire', error);
  }
}

interface FileData {
  kv: Record<string, unknown>;
  hashes: Record<string, Record<string, unknown>>;
  lists: Record<string, unknown[]>;
}

/** Local JSON-file store. Used automatically when Supabase env vars are absent (dev / demo mode). */
export class FileStore implements Store {
  constructor(public path: string) {}

  private read(): FileData {
    if (!existsSync(this.path)) return { kv: {}, hashes: {}, lists: {} };
    return JSON.parse(readFileSync(this.path, 'utf8')) as FileData;
  }
  private write(d: FileData): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(d, null, 1));
  }

  async get<T>(key: string): Promise<T | null> {
    const v = this.read().kv[key];
    return v === undefined ? null : (v as T);
  }
  async set(key: string, value: unknown): Promise<void> {
    const d = this.read();
    d.kv[key] = value;
    this.write(d);
  }
  async hget<T>(key: string, field: string): Promise<T | null> {
    const v = this.read().hashes[key]?.[field];
    return v === undefined ? null : (v as T);
  }
  async hset(key: string, field: string, value: unknown): Promise<void> {
    const d = this.read();
    (d.hashes[key] ??= {})[field] = value;
    this.write(d);
  }
  async lpush(key: string, value: unknown): Promise<void> {
    const d = this.read();
    (d.lists[key] ??= []).unshift(value);
    this.write(d);
  }
  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const l = this.read().lists[key] ?? [];
    return (stop === -1 ? l.slice(start) : l.slice(start, stop + 1)) as T[];
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const d = this.read();
    const rec = d.kv[key] as { n: number; expiresAt: number } | undefined;
    const now = Date.now();
    const live = rec && rec.expiresAt > now ? rec : { n: 0, expiresAt: now + ttlSeconds * 1000 };
    live.n += 1;
    d.kv[key] = live;
    this.write(d);
    return live.n;
  }
  async del(key: string): Promise<void> {
    const d = this.read();
    delete d.kv[key];
    this.write(d);
  }
  /** No-op: the local file is a disposable dev artifact, so nothing sweeps it. */
  async expire(): Promise<void> {}
}

let cached: Store | null = null;

export function getStore(): Store {
  // Store reads are live data: mark the calling route dynamic so Next never
  // prerenders it at build. supabase-js swallows the signal Next throws from
  // an uncached fetch, so this has to happen here, outside the client.
  noStore();
  cached ??= supabaseConfigured()
    ? new SupabaseStore(supabaseAdmin())
    : new FileStore(process.env.FILE_STORE_PATH ?? '.data/store.json');
  return cached;
}

/**
 * Key-namespaced view of another store — the demo's isolation primitive.
 *
 * Every demo visitor gets their own prefix (`demo:{sid}:`), so a demo session
 * reads and writes through the SAME route handlers, the same role guard and
 * the same Store interface as a real operator, while touching none of the
 * production keys. Nothing here filters or sanitizes: isolation is structural,
 * a key that cannot be spelled cannot be reached.
 *
 * `incr` deliberately namespaces too, so a demo visitor hammering a throttled
 * endpoint burns their own counter and not the real one.
 */
export class PrefixedStore implements Store {
  /**
   * @param ttlSeconds when set, every key this view writes is given (or has
   *   refreshed) this expiry. A demo sandbox is thereby self-sweeping: no cron,
   *   no cleanup job, and an abandoned session costs nothing after a day.
   */
  constructor(private inner: Store, private prefix: string, private ttlSeconds?: number) {}

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  /** Refresh the sandbox expiry after a write. Best-effort: never fail a write over it. */
  private async touch(key: string): Promise<void> {
    if (!this.ttlSeconds) return;
    await this.inner.expire(key, this.ttlSeconds).catch(() => {});
  }

  get<T>(key: string): Promise<T | null> {
    return this.inner.get<T>(this.k(key));
  }
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.inner.set(this.k(key), value, ttlSeconds ?? this.ttlSeconds);
  }
  hget<T>(key: string, field: string): Promise<T | null> {
    return this.inner.hget<T>(this.k(key), field);
  }
  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.inner.hset(this.k(key), field, value);
    await this.touch(this.k(key));
  }
  async lpush(key: string, value: unknown): Promise<void> {
    await this.inner.lpush(this.k(key), value);
    await this.touch(this.k(key));
  }
  lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    return this.inner.lrange<T>(this.k(key), start, stop);
  }
  incr(key: string, ttlSeconds: number): Promise<number> {
    return this.inner.incr(this.k(key), ttlSeconds);
  }
  del(key: string): Promise<void> {
    return this.inner.del(this.k(key));
  }
  expire(key: string, ttlSeconds: number): Promise<void> {
    return this.inner.expire(this.k(key), ttlSeconds);
  }
}

/** Wrap a store so every key it sees is written under `prefix`. */
export function prefixed(inner: Store, prefix: string, ttlSeconds?: number): Store {
  return new PrefixedStore(inner, prefix, ttlSeconds);
}
