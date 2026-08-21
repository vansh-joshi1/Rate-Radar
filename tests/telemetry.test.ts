import { describe, expect, it } from 'vitest';
import {
  buildRunTelemetry,
  classifyOutcome,
  record,
  resetTelemetry,
  summarize,
  type AttemptRecord,
} from '../collector/telemetry';

describe('classifyOutcome — separates what the old code conflated', () => {
  it('recognizes the bot-wall error thrown by settlePage', () => {
    // This exact string is thrown by settlePage() in collector/sources/rates.ts.
    const err =
      'Error: Blocked by a bot check on this run — usually transient from datacenter IPs; will retry next collection.';
    expect(classifyOutcome({ result: null, error: err })).toBe('blocked');
  });

  it('recognizes Playwright timeouts', () => {
    expect(classifyOutcome({ result: null, error: 'TimeoutError: Timeout 30000ms exceeded' })).toBe('timeout');
    expect(classifyOutcome({ result: null, error: 'page.goto: Timeout exceeded' })).toBe('timeout');
  });

  it('any other error is error, not no-price', () => {
    expect(classifyOutcome({ result: null, error: 'net::ERR_CONNECTION_REFUSED' })).toBe('error');
  });

  it('a clean run that found nothing is no-price, distinct from blocked', () => {
    expect(classifyOutcome({ result: null, error: null })).toBe('no-price');
  });

  it('a price outside the sanity bounds is sanity-rejected, not ok', () => {
    expect(classifyOutcome({ result: { price: 9 }, error: null, sanityRejected: true })).toBe('sanity-rejected');
  });

  it('a price is ok', () => {
    expect(classifyOutcome({ result: { price: 88 }, error: null })).toBe('ok');
  });

  it('blocked wins over a partial result — a bot wall invalidates whatever rendered', () => {
    expect(classifyOutcome({ result: { price: 88 }, error: 'Blocked by a bot check on this run' })).toBe('blocked');
  });
});

describe('telemetry recorder', () => {
  it('collects records and stamps run-level context', () => {
    resetTelemetry();
    record({ target: 'ours', source: 'redroof', date: '2026-08-21', outcome: 'ok', attempts: 1, durationMs: 1200 });
    record({
      target: 'Quality Inn',
      source: 'booking-direct',
      date: '2026-08-21',
      outcome: 'blocked',
      attempts: 2,
      durationMs: 45000,
    });

    const run = buildRunTelemetry({
      runAt: '2026-08-21T12:00:00.000Z',
      runLeg: 'github-hosted',
      browser: 'playwright',
      profileAgeRuns: 0,
    });

    expect(run.attempts).toHaveLength(2);
    expect(run.runLeg).toBe('github-hosted');
    expect(run.browser).toBe('playwright');
  });

  it('resetTelemetry clears the buffer between runs', () => {
    resetTelemetry();
    record({ target: 'ours', source: 'google', date: '2026-08-21', outcome: 'ok', attempts: 1, durationMs: 10 });
    resetTelemetry();
    const run = buildRunTelemetry({
      runAt: 'x',
      runLeg: 'github-hosted',
      browser: 'playwright',
      profileAgeRuns: 0,
    });
    expect(run.attempts).toHaveLength(0);
  });
});

describe('summarize — the numbers the Settings panel reads', () => {
  const attempts: AttemptRecord[] = [
    { target: 'ours', source: 'redroof', date: 'd', outcome: 'ok', attempts: 1, durationMs: 1 },
    { target: 'a', source: 'booking-direct', date: 'd', outcome: 'blocked', attempts: 2, durationMs: 1 },
    { target: 'b', source: 'booking-direct', date: 'd', outcome: 'blocked', attempts: 2, durationMs: 1 },
    { target: 'c', source: 'booking-direct', date: 'd', outcome: 'unresolved', attempts: 0, durationMs: 0 },
  ];

  it('counts coverage as priced over attempted', () => {
    const s = summarize(attempts);
    expect(s.total).toBe(4);
    expect(s.ok).toBe(1);
    expect(s.blockedShare).toBeCloseTo(0.5);
  });

  it('breaks outcomes down per source so blocked is visibly distinct from no-price', () => {
    const s = summarize(attempts);
    expect(s.bySource['booking-direct'].blocked).toBe(2);
    expect(s.bySource['booking-direct'].unresolved).toBe(1);
    expect(s.bySource.redroof.ok).toBe(1);
  });

  it('an empty run has zero blockedShare rather than NaN', () => {
    expect(summarize([]).blockedShare).toBe(0);
  });
});

describe('regression: a blocked Booking search must not read as a name mismatch', () => {
  // resolveBookingUrl used to call settlePage(...).catch(() => undefined),
  // swallowing the only error settlePage throws — the bot-wall detection. The
  // code then scanned a challenge page for hotel links, found none, and
  // reported "no match". The first production baseline showed 5 of 6 per-hotel
  // checks as "no URL resolved", which was unactionable as a result: a
  // transport problem and an identity problem looked identical.
  const botWall =
    'Error: Blocked by a bot check on this run — usually transient from datacenter IPs; will retry next collection.';

  it('classifies a bot-walled resolve as blocked, not unresolved', () => {
    expect(classifyOutcome({ result: null, error: botWall })).toBe('blocked');
  });

  it('a resolve that genuinely matched nothing stays unresolved', () => {
    // No error: resolveBookingUrl returned { status: 'no-match' }, so the
    // caller records 'unresolved' directly rather than classifying an error.
    expect(classifyOutcome({ result: null, error: null })).not.toBe('blocked');
  });

  it('a timed-out resolve is a timeout, distinct from both', () => {
    expect(classifyOutcome({ result: null, error: 'TimeoutError: Timeout 12000ms exceeded' })).toBe('timeout');
  });
});
