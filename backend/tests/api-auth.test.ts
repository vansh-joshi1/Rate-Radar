import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import {
  APIKEYS_HASH, authenticate, canReadProperty, generateApiKey, hashApiKey, newKeyRecord,
} from '../lib/api/auth';

function reqWithKey(key?: string, header: 'bearer' | 'x-api-key' = 'bearer'): Request {
  const headers: Record<string, string> = {};
  if (key) {
    if (header === 'bearer') headers.authorization = `Bearer ${key}`;
    else headers['x-api-key'] = key;
  }
  return new Request('http://localhost/api/v1/properties', { headers });
}

describe('api key auth', () => {
  let store: FileStore;
  let key: string;

  beforeEach(async () => {
    store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
    key = generateApiKey();
    await store.hset(APIKEYS_HASH, hashApiKey(key), newKeyRecord('test', ['*'], 5));
  });

  it('generates keys in the documented format', () => {
    expect(key).toMatch(/^rr_[0-9a-f]{40}$/);
  });

  it('rejects a missing key', async () => {
    const res = await authenticate(reqWithKey(undefined), store);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it('rejects an unknown key of valid shape', async () => {
    const res = await authenticate(reqWithKey(generateApiKey()), store);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_key');
  });

  it('accepts a stored key via Bearer and x-api-key', async () => {
    expect((await authenticate(reqWithKey(key, 'bearer'), store)).ok).toBe(true);
    expect((await authenticate(reqWithKey(key, 'x-api-key'), store)).ok).toBe(true);
  });

  it('rate limits after rpm requests within the window', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await authenticate(reqWithKey(key), store)).ok).toBe(true);
    }
    const sixth = await authenticate(reqWithKey(key), store);
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.status).toBe(429);
  });

  it('scopes properties: wildcard and explicit lists', () => {
    expect(canReadProperty(newKeyRecord('a', ['*']), 'anything')).toBe(true);
    const scoped = newKeyRecord('b', ['rri-franklin']);
    expect(canReadProperty(scoped, 'rri-franklin')).toBe(true);
    expect(canReadProperty(scoped, 'other-hotel')).toBe(false);
  });
});

describe('file store incr', () => {
  it('counts up within the ttl window', async () => {
    const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
    expect(await store.incr('k', 60)).toBe(1);
    expect(await store.incr('k', 60)).toBe(2);
    expect(await store.incr('k', 60)).toBe(3);
  });
});
