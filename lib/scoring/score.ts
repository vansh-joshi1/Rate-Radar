import type { RawEvent, ScoredEvent, Tier } from './types';
import { travelDraw, venueCapacity } from './venues';

/**
 * Overflow model: how likely is this event to push demand 20 minutes out to
 * Franklin, given downtown Nashville can absorb most of what happens there.
 * K anchors the sublinear draw curve against downtown's absorbable capacity
 * (~20k downtown-core rooms → an event needs tens of thousands of attendees
 * before overflow becomes likely).
 */
const K = 25000;
/** Sun..Sat — weeknights have uncontested downtown capacity, so less spillover. */
const DOW = [0.7, 0.45, 0.45, 0.45, 0.7, 1.0, 1.0];
const FILL_DEFAULT = 0.8;
const FILL_SELLOUT = 1.0;

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function tierOf(score: number): Tier {
  if (score < 15) return 'too-small';
  if (score < 40) return 'minor';
  if (score < 70) return 'meaningful';
  return 'major';
}

const VERDICTS: Record<Tier, string> = {
  'too-small': 'Nearby, likely too small to move demand in Franklin',
  minor: 'Minor signal — unlikely to justify a rate move on its own',
  meaningful: 'Likely to push some overflow demand toward Franklin',
  major: 'Strong overflow likelihood — downtown will be contested',
};

export function scoreEvent(e: RawEvent): ScoredEvent {
  const capacity = e.capacity ?? venueCapacity(e.venue) ?? 2000;
  const fill = e.selloutLikely || e.multiNight ? FILL_SELLOUT : FILL_DEFAULT;
  const attendanceEstimate = e.expectedAttendance ?? Math.round(capacity * fill);

  const baseDraw = (100 * attendanceEstimate) / (attendanceEstimate + K);
  const td = travelDraw(e);
  const dow = DOW[dayOfWeek(e.date)];
  const score = Math.min(100, Math.round(baseDraw * td * dow * 10) / 10);
  const tier = tierOf(score);

  return {
    ...e,
    capacity,
    attendanceEstimate,
    baseDraw: Math.round(baseDraw * 10) / 10,
    travelDraw: td,
    dowMultiplier: dow,
    score,
    tier,
    verdict: VERDICTS[tier],
  };
}

/** Same-night events compound with diminishing returns — never a straight sum. */
export function nightScore(events: Pick<ScoredEvent, 'score'>[]): number {
  return Math.round(100 * (1 - events.reduce((p, e) => p * (1 - e.score / 100), 1)));
}
