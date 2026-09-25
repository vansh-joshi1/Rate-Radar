import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { BOOKINGS_KEY, recordTonight, type Bookings } from '../lib/bookings';
import { getProperty } from '../lib/properties';

const franklin = getProperty('rri-franklin')!;

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-bk-')), 'store.json'));
}

describe('recordTonight', () => {
  // 03:30 UTC on the 26th is still the evening of the 25th in Franklin.
  const now = new Date('2026-09-26T03:30:00Z');

  it("files the reading under tonight in the property's timezone", async () => {
    const store = freshStore();
    const res = await recordTonight(store, franklin, 42, now);
    expect(res).toEqual({ ok: true, date: '2026-09-25', reading: { rooms: 42, at: now.toISOString() } });
    const saved = await store.get<Bookings>(BOOKINGS_KEY);
    expect(saved?.['2026-09-25']).toEqual([{ rooms: 42, at: now.toISOString() }]);
  });

  it('appends later readings instead of overwriting', async () => {
    const store = freshStore();
    await recordTonight(store, franklin, 30, now);
    const later = new Date(now.getTime() + 3600_000);
    await recordTonight(store, franklin, 38, later);
    const saved = await store.get<Bookings>(BOOKINGS_KEY);
    expect(saved?.['2026-09-25'].map((r) => r.rooms)).toEqual([30, 38]);
  });

  it('accepts zero and a full house', async () => {
    const store = freshStore();
    expect((await recordTonight(store, franklin, 0, now)).ok).toBe(true);
    expect((await recordTonight(store, franklin, franklin.totalRooms, now)).ok).toBe(true);
  });

  it('rejects negatives, fractions and more rooms than the hotel has', async () => {
    const store = freshStore();
    for (const bad of [-1, 4.5, franklin.totalRooms + 1, Number.NaN]) {
      expect((await recordTonight(store, franklin, bad, now)).ok).toBe(false);
    }
    expect(await store.get(BOOKINGS_KEY)).toBeNull();
  });
});
