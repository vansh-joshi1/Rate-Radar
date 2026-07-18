import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { storeAdapter } from '../lib/auth/adapter';
import { isAllowed, roleFor, saveMembers } from '../lib/auth/members';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-auth-')), 'store.json'));
}

describe('auth adapter over the store', () => {
  it('creates and finds users by id and email (case-insensitive)', async () => {
    const a = storeAdapter(freshStore());
    // the adapter assigns its own id — the one passed in is ignored
    const user = await a.createUser!({ id: 'ignored', email: 'Desk@Hotel.com', emailVerified: null });
    expect(user.id).toBeTruthy();
    expect(user.id).not.toBe('ignored');
    expect((await a.getUser!(user.id))?.email).toBe('desk@hotel.com');
    expect((await a.getUserByEmail!('DESK@hotel.com'))?.id).toBe(user.id);
    expect(await a.getUserByEmail!('nobody@hotel.com')).toBeNull();
  });

  it('verification tokens are one-time use and expire', async () => {
    const a = storeAdapter(freshStore());
    const future = new Date(Date.now() + 3600_000);
    await a.createVerificationToken!({ identifier: 'desk@hotel.com', token: 'tok1', expires: future });
    const used = await a.useVerificationToken!({ identifier: 'desk@hotel.com', token: 'tok1' });
    expect(used?.token).toBe('tok1');
    // second use must fail — the token is consumed
    expect(await a.useVerificationToken!({ identifier: 'desk@hotel.com', token: 'tok1' })).toBeNull();

    // expired tokens are rejected even if present
    const past = new Date(Date.now() - 1000);
    await a.createVerificationToken!({ identifier: 'desk@hotel.com', token: 'tok2', expires: past });
    expect(await a.useVerificationToken!({ identifier: 'desk@hotel.com', token: 'tok2' })).toBeNull();
  });
});

describe('members gate for magic-link sign-in', () => {
  const OLD = process.env.OWNER_EMAIL;
  beforeEach(() => {
    process.env.OWNER_EMAIL = 'owner@hotel.com';
  });
  afterEach(() => {
    process.env.OWNER_EMAIL = OLD;
  });

  it('OWNER_EMAIL is always allowed as owner; strangers are not', async () => {
    const store = freshStore();
    expect(await roleFor(store, 'Owner@Hotel.com')).toBe('owner');
    expect(await isAllowed(store, 'stranger@example.com')).toBe(false);
  });

  it('invited members get their assigned role', async () => {
    const store = freshStore();
    await saveMembers(store, [{ email: 'desk@hotel.com', role: 'manager', invitedAt: 'x' }]);
    expect(await roleFor(store, 'desk@hotel.com')).toBe('manager');
    expect(await isAllowed(store, 'desk@hotel.com')).toBe(true);
  });
});
