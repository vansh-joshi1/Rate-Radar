import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  lpush(key: string, value: unknown): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
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
