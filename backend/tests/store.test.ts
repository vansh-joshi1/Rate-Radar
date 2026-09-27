import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, SupabaseStore, type Store } from '../lib/store';
import { supabaseAdmin, supabaseConfigured } from '../lib/supabase';

/**
 * One contract, every backend. The Supabase run needs SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY for a project with the migration applied; it
 * writes under a random `test:` prefix and deletes what it wrote.
 */
function contract(name: string, make: () => { store: Store; k: (s: string) => string }) {
  describe(name, () => {
    let store: Store;
    let k: (s: string) => string;
    beforeEach(() => ({ store, k } = make()));

    it('roundtrips get/set with JSON values', async () => {
      expect(await store.get(k('missing'))).toBeNull();
      await store.set(k('kv'), { a: 1, b: ['x'] });
      expect(await store.get(k('kv'))).toEqual({ a: 1, b: ['x'] });
    });

    it('roundtrips hget/hset', async () => {
      expect(await store.hget(k('h'), 'f')).toBeNull();
      await store.hset(k('h'), 'f', { v: 2 });
      await store.hset(k('h'), 'g', 'other');
      expect(await store.hget(k('h'), 'f')).toEqual({ v: 2 });
      expect(await store.hget(k('h'), 'g')).toBe('other');
    });

    it('incr counts up within the ttl window', async () => {
      expect(await store.incr(k('c'), 60)).toBe(1);
      expect(await store.incr(k('c'), 60)).toBe(2);
      expect(await store.incr(k('c'), 60)).toBe(3);
    });
  });
}

contract('FileStore', () => ({
  store: new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-')), 'store.json')),
  k: (s) => s,
}));

if (supabaseConfigured()) {
  const run = `test:${crypto.randomUUID()}:`;
  contract('SupabaseStore', () => ({ store: new SupabaseStore(supabaseAdmin()), k: (s) => run + s }));
  afterAll(async () => {
    await supabaseAdmin().from('kv').delete().like('key', `${run}%`);
  });

  it('SupabaseStore: an expired key reads as missing', async () => {
    const store = new SupabaseStore(supabaseAdmin());
    await store.set(`${run}ttl`, 'x', 60);
    expect(await store.get(`${run}ttl`)).toBe('x');
    // Backdate it rather than sleep.
    await supabaseAdmin().from('kv').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('key', `${run}ttl`);
    expect(await store.get(`${run}ttl`)).toBeNull();
    expect(await store.incr(`${run}ttl`, 60)).toBe(1); // an expired counter restarts
  });
}

it('FileStore persists across instances (same file)', async () => {
  const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-')), 'store.json'));
  await store.set('persist', 42);
  expect(await new FileStore(store.path).get('persist')).toBe(42);
});
