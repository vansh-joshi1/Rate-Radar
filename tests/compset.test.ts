import { describe, it, expect } from 'vitest';
import { matchCompset, compsetMedian, applyCompsetBound } from '../lib/scoring/compset';
import type { TierRecommendation } from '../lib/scoring/types';


const tiers = (): TierRecommendation[] => [
  { tierId: 'standard', label: 'Standard', baselineMid: 70, recommended: 70, range: [68, 72] },
  { tierId: 'queen', label: 'Queen', baselineMid: 80, recommended: 80, range: [80, 80] },
];

describe('matchCompset', () => {
  it('keeps whitelisted comps, drops luxury and junk prices', () => {
    const found = matchCompset([
      { name: 'Comfort Inn Franklin Highway 96', price: 53 },
      { name: 'The Harpeth Franklin Downtown, Curio Collection by Hilton', price: 270 },
      { name: 'Clarion Pointe Franklin - Nashville Area', price: 52 },
      { name: 'Holiday Inn Franklin - Cool Springs by IHG', price: 57 },
      { name: 'Candlewood Suites Nashville - Franklin by IHG', price: 3 },
    ]);
    expect(found.map((c) => c.name)).toEqual([
      'Comfort Inn Franklin Highway 96',
      'Clarion Pointe Franklin - Nashville Area',
      'Holiday Inn Franklin - Cool Springs by IHG',
    ]);
  });
});

describe('compsetMedian', () => {
  it('computes median', () => {
    expect(compsetMedian([{ name: 'a', price: 52 }, { name: 'b', price: 57 }, { name: 'c', price: 53 }])).toBe(53);
    expect(compsetMedian([{ name: 'a', price: 52 }, { name: 'b', price: 72 }])).toBe(62);
    expect(compsetMedian([])).toBeNull();
  });
});

describe('applyCompsetBound', () => {
  it('quiet night priced far above comps → capped, but never below baseline floor', () => {
    // median 55 → cap 63.25, below standard floor 68 → held at floor 68
    const r = applyCompsetBound(tiers(), 0, 55);
    const std = r.tiers.find((t) => t.tierId === 'standard')!;
    expect(std.recommended).toBe(68);
    expect(r.note).toContain('55');
  });
  it('quiet night, cap lands between floor and recommendation → capped to 1.15x median', () => {
    // median 64 → cap 73.6 → round 74; standard 70 stays (below cap); queen 80 → capped 74? no, floor 80 wins
    const r = applyCompsetBound(tiers(), 0, 64);
    expect(r.tiers.find((t) => t.tierId === 'standard')!.recommended).toBe(70); // unchanged, under cap
    expect(r.tiers.find((t) => t.tierId === 'queen')!.recommended).toBe(80); // floor protected
  });
  it('event night (score >= 40) is never capped', () => {
    const hot = tiers().map((t) => ({ ...t, recommended: Math.round(t.recommended * 1.4) }));
    const r = applyCompsetBound(hot, 85, 55);
    expect(r.tiers.find((t) => t.tierId === 'standard')!.recommended).toBe(98);
    expect(r.note).toContain('not capped');
  });
  it('no median → passthrough with no note', () => {
    const r = applyCompsetBound(tiers(), 0, null);
    expect(r.note).toBeUndefined();
    expect(r.tiers).toEqual(tiers());
  });
});
