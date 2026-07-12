import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';

describe('FileStore', () => {
  let store: FileStore;
  beforeEach(() => {
    store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-')), 'store.json'));
  });

  it('roundtrips get/set with JSON values', async () => {
    expect(await store.get('missing')).toBeNull();
    await store.set('k', { a: 1, b: ['x'] });
    expect(await store.get('k')).toEqual({ a: 1, b: ['x'] });
  });

  it('roundtrips hget/hset', async () => {
    expect(await store.hget('h', 'f')).toBeNull();
    await store.hset('h', 'f', { v: 2 });
    expect(await store.hget('h', 'f')).toEqual({ v: 2 });
  });

  it('lpush prepends and lrange slices', async () => {
    await store.lpush('l', 'first');
    await store.lpush('l', 'second');
    expect(await store.lrange('l', 0, -1)).toEqual(['second', 'first']);
    expect(await store.lrange('l', 0, 0)).toEqual(['second']);
  });

  it('persists across instances (same file)', async () => {
    await store.set('persist', 42);
    const again = new FileStore(store.path);
    expect(await again.get('persist')).toBe(42);
  });
});
