import { describe, expect, it } from 'vitest';
import { AccessRequestBody, getAccessRequest, saveAccessRequest } from '../lib/access-requests';
import { FileStore } from '../lib/store';
import { passwordOk } from '../lib/password';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const valid = {
  email: ' GM@Hotel.com ',
  password: 'horse-42-battery',
  phone: '(615) 555-0142',
  name: 'Harbor Pine Inn',
  address: '1 Main St, Kestrel Bay, OR 97000',
  rooms: '48',
  type: 'Inn',
  token: null,
  channels: ['Expedia'],
  listings: { direct: '', expedia: '', booking: '' },
  roomTypes: [{ name: 'King', tier: 'standard', price: 99 }],
  competitors: ['Seabreeze Motel'],
  terms: true,
};

describe('AccessRequestBody', () => {
  it('accepts a complete request and normalizes email and rooms', () => {
    const r = AccessRequestBody.parse(valid);
    expect(r.email).toBe('gm@hotel.com');
    expect(r.rooms).toBe(48);
  });

  it('refuses a password missing any rule: length, letter, number, special character', () => {
    for (const pw of ['a1!b2@', 'password1', 'password!', '12345678!', 'pass word 12']) {
      expect(passwordOk(pw), pw).toBe(false);
      expect(AccessRequestBody.safeParse({ ...valid, password: pw }).success, pw).toBe(false);
    }
    expect(passwordOk('abc12345!')).toBe(true);
  });

  it('refuses a short phone and an empty compset', () => {
    expect(AccessRequestBody.safeParse({ ...valid, phone: '555-0142' }).success).toBe(false);
    expect(AccessRequestBody.safeParse({ ...valid, competitors: [] }).success).toBe(false);
  });

  it('refuses a request without the terms box ticked, and non-http listing links', () => {
    expect(AccessRequestBody.safeParse({ ...valid, terms: undefined }).success).toBe(false);
    expect(AccessRequestBody.safeParse({ ...valid, terms: false }).success).toBe(false);
    const listings = (direct: string) => ({ ...valid, listings: { ...valid.listings, direct } });
    expect(AccessRequestBody.safeParse(listings('javascript:alert(1)')).success).toBe(false);
    expect(AccessRequestBody.safeParse(listings('data:text/html,hi')).success).toBe(false);
    expect(AccessRequestBody.safeParse(listings('https://harborpine.example')).success).toBe(true);
  });

  it('round-trips through the store without the password', async () => {
    const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-')), 'store.json'));
    const { password: _, terms: __, ...details } = AccessRequestBody.parse(valid);
    await saveAccessRequest(store, { ...details, status: 'pending', submittedAt: '2026-09-25T00:00:00Z' });
    const saved = await getAccessRequest(store, 'GM@hotel.com');
    expect(saved?.status).toBe('pending');
    expect(saved).not.toHaveProperty('password');
  });
});
