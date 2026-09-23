import { describe, it, expect } from 'vitest';
import { isTrackedChannel, trackedParity, CHANNEL_POLICY } from '../lib/parity/channels';
import type { RateCheck } from '../lib/scoring/types';
import { toParityChecks } from '../collector/sources/rates';
import detail from './fixtures/serp-detail-redroof.json';

const check = (source: string, extra: Partial<RateCheck> = {}): RateCheck => ({
  source,
  status: 'ok',
  price: 80,
  fetchedAt: '2026-09-22T12:00:00.000Z',
  ...extra,
});

describe('isTrackedChannel', () => {
  it('keeps the direct listing on the official flag, whatever it is named', () => {
    // The official entry carries the property's own name, which differs per
    // property — matching it by name would work for exactly one hotel.
    expect(isTrackedChannel(check('Red Roof Inn Nashville - Franklin', { official: true }))).toBe(true);
    expect(isTrackedChannel(check('Some Other Inn & Suites', { official: true }))).toBe(true);
  });

  it('keeps Booking.com and Expedia.com', () => {
    expect(isTrackedChannel(check('Booking.com'))).toBe(true);
    expect(isTrackedChannel(check('Expedia.com'))).toBe(true);
  });

  it('matches regardless of case, spacing, or a .com suffix', () => {
    for (const name of ['booking.com', 'BOOKING.COM', '  Booking.com  ', 'Booking', 'expedia', 'Expedia.COM']) {
      expect(isTrackedChannel(check(name))).toBe(true);
    }
  });

  it('rejects the other Expedia Group brands', () => {
    // Hotels.com, Travelocity, Orbitz and CheapTickets are all Expedia Group,
    // and all appear in live data. "Expedia" means Expedia, not its family.
    for (const name of ['Hotels.com', 'Travelocity.com', 'Orbitz.com', 'CheapTickets.com']) {
      expect(isTrackedChannel(check(name))).toBe(false);
    }
  });

  it('rejects every other reseller', () => {
    for (const name of ['Super.com', 'dealbase.com', 'Traveluro', 'Agoda', 'Priceline', 'Trip.com', 'google']) {
      expect(isTrackedChannel(check(name))).toBe(false);
    }
  });

  it('does not match on substrings', () => {
    // A reseller whose name merely contains a tracked brand is not that brand.
    expect(isTrackedChannel(check('Bookings Direct'))).toBe(false);
    expect(isTrackedChannel(check('Expedia Affiliate Network Deals'))).toBe(false);
  });

  it('keeps a tracked channel that reported no price', () => {
    // Absence of a price is information — the filter is about WHICH channel,
    // not whether it answered.
    const unpriced = check('Booking.com', { status: 'needs-manual-check', price: undefined });
    expect(isTrackedChannel(unpriced)).toBe(true);
    expect(trackedParity([unpriced])).toEqual([unpriced]);
  });
});

describe('trackedParity', () => {
  it('reduces a full 26-channel run to the three that count, in order', () => {
    const parity = [
      check('Red Roof Inn Nashville - Franklin', { official: true, price: 80 }),
      check('Super.com', { price: 62 }),
      check('dealbase.com', { price: 64 }),
      check('Expedia.com', { price: 81 }),
      check('Agoda', { price: 81 }),
      check('Booking.com', { price: 81 }),
      check('Hotels.com', { price: 81 }),
    ];
    expect(trackedParity(parity).map((p) => p.source)).toEqual([
      'Red Roof Inn Nashville - Franklin',
      'Expedia.com',
      'Booking.com',
    ]);
  });

  it('is empty when a run returned none of the three', () => {
    expect(trackedParity([check('Super.com'), check('Agoda')])).toEqual([]);
  });

  it('passes an empty run through', () => {
    expect(trackedParity([])).toEqual([]);
  });
});

describe('against the real SerpApi response', () => {
  it('reduces a live 26-channel property-details response to the three reported', () => {
    const checks = toParityChecks(detail as never, [], '2026-09-22T12:00:00.000Z');
    expect(checks.length).toBe(26); // everything is still collected and stored

    const tracked = trackedParity(checks);
    expect(tracked.map((p) => p.source)).toEqual([
      'Red Roof Inn Nashville - Franklin',
      'Expedia.com',
      'Booking.com',
    ]);
    expect(tracked[0].official).toBe(true);
  });

  it('narrows the reported spread to $1, and that is the documented cost', () => {
    const tracked = trackedParity(toParityChecks(detail as never, [], 'x'));
    const prices = tracked.map((p) => p.price!).filter((n) => typeof n === 'number');
    expect(Math.max(...prices) - Math.min(...prices)).toBe(1);

    // What is no longer reported: direct $80 against Super.com at $62.
    const all = toParityChecks(detail as never, [], 'x').filter((p) => p.price != null);
    expect(Math.max(...all.map((p) => p.price!)) - Math.min(...all.map((p) => p.price!))).toBe(19);
  });
});

describe('CHANNEL_POLICY', () => {
  it('names the policy for API consumers', () => {
    expect(CHANNEL_POLICY).toContain('direct');
    expect(CHANNEL_POLICY.toLowerCase()).toContain('booking');
    expect(CHANNEL_POLICY.toLowerCase()).toContain('expedia');
  });
});
