import { describe, it, expect } from 'vitest';
import { carryForwardParity } from '../lib/ingest';

describe('carryForwardParity', () => {
  const fresh = [{ source: 'Booking.com', status: 'ok' as const, price: 68, fetchedAt: 'now' }];
  const previous = [
    { source: 'Red Roof Inn', official: true, status: 'ok' as const, price: 80, fetchedAt: 'this morning' },
    { source: 'Super.com', status: 'ok' as const, price: 62, fetchedAt: 'this morning' },
  ];

  it('keeps the run’s own parity when it fetched some', () => {
    expect(carryForwardParity(fresh, previous)).toEqual(fresh);
  });

  it('reuses the last run’s parity when this run did not buy any', () => {
    // Only the 07:00 slot spends a search on parity; the 13:00 and 18:00 runs
    // must not blank the panel for the rest of the day.
    expect(carryForwardParity([], previous)).toEqual(previous);
  });

  it('stays empty when there is nothing to carry forward', () => {
    expect(carryForwardParity([], [])).toEqual([]);
    expect(carryForwardParity([], undefined)).toEqual([]);
  });
});
