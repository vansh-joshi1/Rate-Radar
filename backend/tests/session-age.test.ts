import { describe, expect, it } from 'vitest';
import { MAX_SESSION_SECONDS, SHARED_LOGIN_EMAIL, sessionExpired } from '../lib/auth/session-age';

const now = Date.UTC(2026, 8, 30);
const signedIn = (secondsAgo: number) => [{ method: 'password', timestamp: now / 1000 - secondsAgo }];

describe('sessionExpired', () => {
  it('ends a personal sign-in after a week, the shared front-desk one after 12 hours', () => {
    const day = 86400;
    expect(sessionExpired({ email: 'gm@hotel.com', amr: signedIn(6 * day) }, now)).toBe(false);
    expect(sessionExpired({ email: 'gm@hotel.com', amr: signedIn(MAX_SESSION_SECONDS.personal + 1) }, now)).toBe(true);
    expect(sessionExpired({ email: SHARED_LOGIN_EMAIL, amr: signedIn(11 * 3600) }, now)).toBe(false);
    expect(sessionExpired({ email: SHARED_LOGIN_EMAIL, amr: signedIn(13 * 3600) }, now)).toBe(true);
  });

  it('measures from the latest sign-in step, and lets a token without timestamps through', () => {
    const amr = [...signedIn(30 * 86400), { method: 'totp', timestamp: now / 1000 - 60 }];
    expect(sessionExpired({ email: 'gm@hotel.com', amr }, now)).toBe(false);
    expect(sessionExpired({ email: 'gm@hotel.com', amr: ['pwd'] }, now)).toBe(false);
    expect(sessionExpired({ email: 'gm@hotel.com' }, now)).toBe(false);
  });
});
