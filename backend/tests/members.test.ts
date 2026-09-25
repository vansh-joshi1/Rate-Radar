import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { isAllowed, roleFor, saveMembers } from '../lib/auth/members';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-auth-')), 'store.json'));
}

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

describe('post-sign-in redirect', () => {
  it('keeps same-site paths and drops everything else', async () => {
    const { safeNext } = await import('../auth');
    expect(safeNext('/calendar?d=1')).toBe('/calendar?d=1');
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', undefined, 42]) {
      expect(safeNext(bad)).toBe('/overview');
    }
  });
});
