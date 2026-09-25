import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Store } from '../store';

/**
 * v1 API authentication + rate limiting.
 *
 * Keys look like `rr_<40 hex>`. Only the SHA-256 hash is stored (hash field of
 * the `apikeys` store hash), so a leaked store dump never reveals usable keys.
 * Rate limiting is a fixed one-minute window counter per key, kept in the same
 * store — one INCR per request, which stays comfortably inside Upstash's free
 * tier and works identically against the local file store.
 */

export interface ApiKeyRecord {
  name: string;
  createdAt: string;
  /** Property ids this key may read; ['*'] = all. */
  propertyIds: string[];
  /** Requests per minute. */
  rpm: number;
}

export const APIKEYS_HASH = 'apikeys';
const DEFAULT_RPM = 60;

export function generateApiKey(): string {
  return `rr_${randomBytes(20).toString('hex')}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function newKeyRecord(name: string, propertyIds: string[] = ['*'], rpm = DEFAULT_RPM): ApiKeyRecord {
  return { name, createdAt: new Date().toISOString(), propertyIds, rpm };
}

function extractKey(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.headers.get('x-api-key')?.trim() ?? null;
}

export type AuthResult =
  | { ok: true; record: ApiKeyRecord; keyHash: string }
  | { ok: false; status: number; code: string; message: string };

export async function authenticate(req: Request, store: Store): Promise<AuthResult> {
  const key = extractKey(req);
  if (!key || !/^rr_[0-9a-f]{40}$/.test(key)) {
    return { ok: false, status: 401, code: 'missing_key', message: 'Pass an API key via "Authorization: Bearer rr_…" or "x-api-key".' };
  }
  const keyHash = hashApiKey(key);
  const record = await store.hget<ApiKeyRecord>(APIKEYS_HASH, keyHash);
  if (!record) {
    // Constant-time compare against itself keeps timing uniform on the miss path.
    timingSafeEqual(Buffer.from(keyHash), Buffer.from(keyHash));
    return { ok: false, status: 401, code: 'invalid_key', message: 'Unknown API key.' };
  }

  const minute = Math.floor(Date.now() / 60_000);
  const count = await store.incr(`rl:${keyHash}:${minute}`, 90);
  if (count > (record.rpm || DEFAULT_RPM)) {
    return { ok: false, status: 429, code: 'rate_limited', message: `Rate limit of ${record.rpm} requests/minute exceeded.` };
  }
  return { ok: true, record, keyHash };
}

export function canReadProperty(record: ApiKeyRecord, propertyId: string): boolean {
  return record.propertyIds.includes('*') || record.propertyIds.includes(propertyId);
}

/** Uniform success envelope: payload plus the provenance a consumer needs to judge freshness. */
export function envelope<T>(data: T, meta: Record<string, unknown>) {
  return { data, meta: { ...meta, generatedAt: new Date().toISOString() } };
}

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
