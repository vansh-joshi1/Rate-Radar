import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

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

/** Upstash Redis via REST (Vercel Marketplace injects KV_REST_API_URL / KV_REST_API_TOKEN). */
class UpstashStore implements Store {
  constructor(private url: string, private token: string) {}

  private async cmd<T>(parts: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      // no-store is load-bearing: Next.js data-caches fetches made inside
      // server components, which froze an early empty read of snapshot:latest
      // and made the dashboard show "No data yet" forever. Never cache store I/O.
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parts),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { result: T };
    return json.result;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.cmd<string | null>(['GET', key]);
    return raw == null ? null : (JSON.parse(raw) as T);
  }
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const parts: (string | number)[] = ['SET', key, JSON.stringify(value)];
    if (ttlSeconds) parts.push('EX', ttlSeconds);
    await this.cmd(parts);
  }
  async hget<T>(key: string, field: string): Promise<T | null> {
    const raw = await this.cmd<string | null>(['HGET', key, field]);
    return raw == null ? null : (JSON.parse(raw) as T);
  }
  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.cmd(['HSET', key, field, JSON.stringify(value)]);
  }
  async lpush(key: string, value: unknown): Promise<void> {
    await this.cmd(['LPUSH', key, JSON.stringify(value)]);
  }
  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const raw = await this.cmd<string[]>(['LRANGE', key, start, stop]);
    return raw.map((r) => JSON.parse(r) as T);
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.cmd<number>(['INCR', key]);
    if (n === 1) await this.cmd(['EXPIRE', key, ttlSeconds]);
    return n;
  }
  async del(key: string): Promise<void> {
    await this.cmd(['DEL', key]);
  }
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.cmd(['EXPIRE', key, ttlSeconds]);
  }
}

interface FileData {
  kv: Record<string, unknown>;
  hashes: Record<string, Record<string, unknown>>;
  lists: Record<string, unknown[]>;
}

/** Local JSON-file store. Used automatically when Upstash env vars are absent (dev / demo mode). */
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
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  cached =
    url && token
      ? new UpstashStore(url, token)
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
