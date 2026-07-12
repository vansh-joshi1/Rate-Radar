import { describe, it, expect } from 'vitest';
import { upliftPct, recommendNight, confidence } from '../lib/scoring/recommend';
import type { SourceResult } from '../lib/scoring/types';

describe('upliftPct', () => {
  it('is zero below the meaningful line', () => {
    expect(upliftPct(0)).toBe(0);
    expect(upliftPct(39)).toBe(0);
  });
  it('maps 40..100 onto 5..40 linearly', () => {
    expect(upliftPct(40)).toBe(5);
    expect(upliftPct(70)).toBe(22.5);
    expect(upliftPct(100)).toBe(40);
  });
});

describe('recommendNight', () => {
  it('quiet Saturday → weekend baseline, no uplift', () => {
    const r = recommendNight('2026-07-18', 0); // Saturday
    const std = r.find((t) => t.tierId === 'standard')!;
    expect(std.recommended).toBe(85);
    expect(std.range).toEqual([80, 90]);
  });
  it('busy Saturday (score 70) → +22.5%', () => {
    const r = recommendNight('2026-07-18', 70);
    const std = r.find((t) => t.tierId === 'standard')!;
    expect(std.recommended).toBe(104); // round(85*1.225)
    expect(std.range).toEqual([98, 110]);
    const q = r.find((t) => t.tierId === 'queen')!;
    expect(q.recommended).toBe(116); // round(95*1.225)
  });
  it('quiet Tuesday → weekday baseline', () => {
    const r = recommendNight('2026-07-14', 0);
    const std = r.find((t) => t.tierId === 'standard')!;
    expect(std.recommended).toBe(70);
    expect(std.range).toEqual([68, 72]);
  });
});

describe('confidence', () => {
  const src = (source: string, ok: boolean): SourceResult => ({
    source,
    status: ok ? 'ok' : 'failed',
    fetchedAt: new Date().toISOString(),
  });
  it('all sources ok → 100', () => {
    const all = ['rates', 'ticketmaster', 'cfbd', 'nws', 'faa', 'calendars', 'holidays'].map(
      (s) => src(s, true)
    );
    expect(confidence(all).value).toBe(100);
  });
  it('rates down → 70, and the note names it', () => {
    const all = ['rates', 'ticketmaster', 'cfbd', 'nws', 'faa', 'calendars', 'holidays'].map(
      (s) => src(s, s !== 'rates')
    );
    const c = confidence(all);
    expect(c.value).toBe(70);
    expect(c.note).toContain('rates');
  });
});
