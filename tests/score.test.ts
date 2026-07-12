import { describe, it, expect } from 'vitest';
import { scoreEvent, nightScore } from '../lib/scoring/score';
import type { RawEvent } from '../lib/scoring/types';

function ev(overrides: Partial<RawEvent>): RawEvent {
  return {
    id: 'e1',
    name: 'Test event',
    date: '2026-07-18', // a Saturday
    venue: 'Bridgestone Arena',
    capacity: null,
    kind: 'concert',
    source: 'test',
    ...overrides,
  };
}

describe('scoreEvent', () => {
  it('stadium sellout touring show on Saturday is major', () => {
    const s = scoreEvent(
      ev({ venue: 'Nissan Stadium', isTouring: true, selloutLikely: true })
    );
    // a=69000 → base=100*69000/94000=73.4 → *1.5 *1.0 = 110 → clamp 100
    expect(s.score).toBe(100);
    expect(s.tier).toBe('major');
  });

  it('mid-size arena touring show on a Tuesday is minor', () => {
    const s = scoreEvent(ev({ date: '2026-07-14', isTouring: true }));
    // a=17100*0.8=13680 → base=100*13680/38680=35.4 → *1.2 *0.45 = 19.1
    expect(s.score).toBeCloseTo(19.1, 0);
    expect(s.tier).toBe('minor');
  });

  it('300-cap club show scores ~0 and says so honestly', () => {
    const s = scoreEvent(ev({ venue: 'Exit/In', capacity: 300 }));
    expect(s.score).toBeLessThan(2);
    expect(s.tier).toBe('too-small');
    expect(s.verdict.toLowerCase()).toContain('too small');
  });

  it('NHL regular season Saturday game stays sub-meaningful', () => {
    const s = scoreEvent(ev({ kind: 'sports', name: 'Predators vs Blues' }));
    // a=13680 → 35.4 * 0.6 * 1.0 = 21.2 → minor
    expect(s.tier).toBe('minor');
  });

  it('Vandy home football Saturday is meaningful', () => {
    const s = scoreEvent(
      ev({ kind: 'sports', venue: 'FirstBank Stadium', name: 'Vanderbilt vs Tennessee' })
    );
    // a=34000*0.8=27200 → base=52.1 → *1.0 *1.0 = 52.1
    expect(s.score).toBeCloseTo(52.1, 0);
    expect(s.tier).toBe('meaningful');
  });

  it('expectedAttendance overrides capacity heuristic', () => {
    const s = scoreEvent(
      ev({ kind: 'convention', venue: 'Music City Center', expectedAttendance: 12000 })
    );
    // base=100*12000/37000=32.4 → *1.3 *1.0 = 42.2 → meaningful
    expect(s.tier).toBe('meaningful');
  });
});

describe('nightScore compounding', () => {
  it('compounds with diminishing returns, not straight sum', () => {
    const a = { score: 60 } as never;
    const b = { score: 40 } as never;
    expect(nightScore([a, b])).toBe(76); // 100*(1-0.4*0.6)
  });
  it('empty night is zero', () => {
    expect(nightScore([])).toBe(0);
  });
});
