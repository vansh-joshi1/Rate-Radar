import { describe, it, expect } from 'vitest';
import { evaluateAlerts, type AlertInput } from '../lib/alerts/rules';

const NOW = '2026-07-12T12:00:00-05:00';

function base(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    nights: [],
    parity: [],
    weatherAlerts: [],
    holidays: [],
    prevEmailed: {},
    fingerprints: {},
    seenEventIds: [],
    now: NOW,
    ...overrides,
  };
}

function night(date: string, recommended: number, events: never[] = []) {
  return {
    date,
    nightScore: 0,
    upliftPct: 0,
    events,
    tiers: [{ tierId: 'standard', label: 'Standard', baselineMid: 85, recommended, range: [80, 90] as [number, number] }],
    reasoning: [],
    dow: 6,
  };
}

describe('rate change trigger (>= $5 or >= 7% vs last-emailed)', () => {
  it('$4 move does not fire', () => {
    const r = evaluateAlerts(base({ nights: [night('2026-07-18', 89)], prevEmailed: { '2026-07-18': 85 } }));
    expect(r.triggers).toHaveLength(0);
  });
  it('$5 move fires', () => {
    const r = evaluateAlerts(base({ nights: [night('2026-07-18', 90)], prevEmailed: { '2026-07-18': 85 } }));
    expect(r.triggers.some((t) => t.type === 'rate-change')).toBe(true);
  });
  it('first-ever email state does not spam every night', () => {
    const r = evaluateAlerts(base({ nights: [night('2026-07-18', 85)], prevEmailed: {} }));
    expect(r.triggers).toHaveLength(0);
    expect(r.newEmailedState['2026-07-18']).toBe(85);
  });
});

describe('parity gap trigger (>= $8 or >= 10%)', () => {
  const check = (source: string, price: number) => ({
    source: source as never, status: 'ok' as const, price, fetchedAt: NOW,
  });
  it('$7 / 9.7% spread does not fire', () => {
    const r = evaluateAlerts(base({ parity: [check('redroof', 72), check('expedia', 74), check('booking', 79)] }));
    expect(r.triggers).toHaveLength(0);
  });
  it('$9 / 12.9% spread fires with both sources named', () => {
    const r = evaluateAlerts(base({ parity: [check('redroof', 70), check('booking', 79)] }));
    const t = r.triggers.find((x) => x.type === 'parity-gap');
    expect(t).toBeDefined();
    expect(t!.line).toContain('redroof');
    expect(t!.line).toContain('booking');
  });
  it('needs-manual-check sources are ignored, not treated as $0', () => {
    const r = evaluateAlerts(base({
      parity: [check('redroof', 72), { source: 'google' as never, status: 'needs-manual-check' as const, fetchedAt: NOW }],
    }));
    expect(r.triggers).toHaveLength(0);
  });
});

describe('new meaningful event trigger (score >= 40, first seen)', () => {
  const evt = (id: string, score: number) => ({
    id, name: 'Big Show', venue: 'Nissan Stadium', date: '2026-07-18', score, tier: 'meaningful',
  });
  it('score 40 first-seen fires; 39 does not; seen-before does not', () => {
    const n40 = { ...night('2026-07-18', 85), events: [evt('a', 40)] as never[] };
    expect(evaluateAlerts(base({ nights: [n40] })).triggers.some((t) => t.type === 'new-event')).toBe(true);

    const n39 = { ...night('2026-07-18', 85), events: [evt('b', 39)] as never[] };
    expect(evaluateAlerts(base({ nights: [n39] })).triggers).toHaveLength(0);

    expect(
      evaluateAlerts(base({ nights: [n40], seenEventIds: ['a'] })).triggers
    ).toHaveLength(0);
  });
});

describe('weather + holiday triggers', () => {
  it('Severe fires, Moderate does not', () => {
    const wa = (severity: string) => [{ event: 'Winter Storm Warning', severity, headline: 'h', isWinter: true, area: 'Williamson' }];
    expect(evaluateAlerts(base({ weatherAlerts: wa('Severe') })).triggers.some((t) => t.type === 'weather')).toBe(true);
    expect(evaluateAlerts(base({ weatherAlerts: wa('Moderate') })).triggers).toHaveLength(0);
  });
  it('holiday within 14 days fires once', () => {
    const h = [{ name: 'Labor Day weekend', date: '2026-07-20', drawProfile: 'meaningful' }];
    const first = evaluateAlerts(base({ holidays: h }));
    expect(first.triggers.some((t) => t.type === 'holiday')).toBe(true);
    const second = evaluateAlerts(base({ holidays: h, fingerprints: first.newFingerprints }));
    expect(second.triggers).toHaveLength(0);
  });
  it('holiday 20 days out does not fire yet', () => {
    const h = [{ name: 'Labor Day weekend', date: '2026-08-01', drawProfile: 'meaningful' }];
    expect(evaluateAlerts(base({ holidays: h })).triggers).toHaveLength(0);
  });
});

describe('fingerprint dedupe', () => {
  it('same rate alert suppressed within 24h, refires when value moves again', () => {
    const first = evaluateAlerts(base({ nights: [night('2026-07-18', 92)], prevEmailed: { '2026-07-18': 85 } }));
    expect(first.triggers).toHaveLength(1);

    // Same value again 1h later, prevEmailed now updated → no re-alert
    const second = evaluateAlerts(base({
      nights: [night('2026-07-18', 92)],
      prevEmailed: first.newEmailedState,
      fingerprints: first.newFingerprints,
      now: '2026-07-12T13:00:00-05:00',
    }));
    expect(second.triggers).toHaveLength(0);

    // Value jumps again past threshold → fires despite recent email
    const third = evaluateAlerts(base({
      nights: [night('2026-07-18', 99)],
      prevEmailed: first.newEmailedState,
      fingerprints: first.newFingerprints,
      now: '2026-07-12T14:00:00-05:00',
    }));
    expect(third.triggers).toHaveLength(1);
  });
});
