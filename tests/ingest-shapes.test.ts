import { describe, it, expect } from 'vitest';
import { parseRatesData } from '../lib/ingest';

const FALLBACK = '2026-07-14';
const check = { source: 'booking', status: 'ok', price: 68, fetchedAt: 'x' };
const comp = { name: 'Comfort Inn Franklin Highway 96', price: 53 };

describe('parseRatesData accepts all payload generations', () => {
  it('v1: plain RateCheck[]', () => {
    const r = parseRatesData([check], FALLBACK);
    expect(r.parity).toHaveLength(1);
    expect(r.compsets).toEqual([]);
  });

  it('v2: single compset + date', () => {
    const r = parseRatesData({ checks: [check], compset: [comp], compsetDate: '2026-07-20' }, FALLBACK);
    expect(r.parity).toHaveLength(1);
    expect(r.compsets).toEqual([{ date: '2026-07-20', entries: [comp] }]);
  });

  it('v2 without date falls back to tomorrow', () => {
    const r = parseRatesData({ checks: [check], compset: [comp] }, FALLBACK);
    expect(r.compsets[0].date).toBe(FALLBACK);
  });

  it('v3: multi-date compsets pass through', () => {
    const r = parseRatesData(
      { checks: [check], compsets: [{ date: '2026-07-14', entries: [comp] }, { date: '2026-07-25', entries: [] }] },
      FALLBACK
    );
    expect(r.compsets).toHaveLength(2);
    expect(r.compsets[1]).toEqual({ date: '2026-07-25', entries: [] });
  });

  it('null → empty everything', () => {
    expect(parseRatesData(null, FALLBACK)).toEqual({ parity: [], compsets: [] });
  });
});
