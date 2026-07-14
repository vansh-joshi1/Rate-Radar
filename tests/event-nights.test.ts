import { describe, it, expect } from 'vitest';
import { pickCompsetDates } from '../collector/eventNights';
import type { RawEvent } from '../lib/scoring/types';

const TODAY = '2026-07-13';

function ev(date: string, overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    id: `e:${date}:${overrides.name ?? 'x'}`,
    name: 'Stadium Show',
    date,
    venue: 'Nissan Stadium',
    capacity: 69000,
    kind: 'concert',
    isTouring: true,
    selloutLikely: true,
    source: 'test',
    ...overrides,
  };
}

describe('pickCompsetDates', () => {
  it('picks nights scoring >= 40, excludes tomorrow, sorted, capped', () => {
    const events = [
      ev('2026-07-14'), // tomorrow — excluded even though massive
      ev('2026-07-24'),
      ev('2026-07-25'),
      ev('2026-07-18', { name: 'club gig', venue: 'Exit/In', capacity: 300, isTouring: false, selloutLikely: false }), // tiny
      ev('2026-08-01'),
      ev('2026-07-31'),
    ];
    expect(pickCompsetDates(events, TODAY)).toEqual(['2026-07-24', '2026-07-25', '2026-07-31']);
  });

  it('ignores events outside the 21-night window', () => {
    expect(pickCompsetDates([ev('2026-09-15')], TODAY)).toEqual([]);
  });

  it('compounds multiple sub-40 events on one night', () => {
    // two arena touring shows on a Friday: each 42ish alone — but even one clears 40, so use
    // two sports events that individually sit below 40 and only clear it together
    const events = [
      ev('2026-07-24', { name: 'A', venue: 'Bridgestone Arena', capacity: 17100, kind: 'sports', isTouring: false, selloutLikely: false }), // ~21
      ev('2026-07-24', { name: 'B', venue: 'GEODIS Park', capacity: 30000, kind: 'sports', isTouring: false, selloutLikely: false }), // ~33
    ];
    expect(pickCompsetDates(events, TODAY)).toEqual(['2026-07-24']); // 100*(1-.79*.67) ≈ 47
  });
});
