import { describe, it, expect } from 'vitest';
import { evaluateAlerts, type AlertInput, type SourceHealth } from '../lib/alerts/rules';

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

const failing = (source: string) => ({ source, status: 'failed' as const });
const okSource = (source: string) => ({ source, status: 'ok' as const });

describe('source-health trigger (3 consecutive failed runs)', () => {
  it('1st and 2nd consecutive failures do not fire, 3rd fires', () => {
    let health: Record<string, SourceHealth> = {};
    for (const expectFire of [false, false, true]) {
      const r = evaluateAlerts(base({ sources: [failing('ticketmaster')], sourceHealth: health }));
      expect(r.triggers.some((t) => t.type === 'source-health')).toBe(expectFire);
      health = r.newSourceHealth;
      // fingerprints must NOT carry over here — we're testing the counter, not dedupe
    }
    expect(health.ticketmaster.consecutiveFails).toBe(3);
    expect(health.ticketmaster.alerting).toBe(true);
  });

  it('an ok run resets the counter', () => {
    const r1 = evaluateAlerts(base({ sources: [failing('cfbd')], sourceHealth: {} }));
    const r2 = evaluateAlerts(base({ sources: [okSource('cfbd')], sourceHealth: r1.newSourceHealth }));
    expect(r2.newSourceHealth.cfbd.consecutiveFails).toBe(0);
    const r3 = evaluateAlerts(base({ sources: [failing('cfbd')], sourceHealth: r2.newSourceHealth }));
    expect(r3.newSourceHealth.cfbd.consecutiveFails).toBe(1);
    expect(r3.triggers.some((t) => t.type === 'source-health')).toBe(false);
  });

  it('recovery after an alert fires a healthy-again notice', () => {
    const health: Record<string, SourceHealth> = { calendars: { consecutiveFails: 5, alerting: true } };
    const r = evaluateAlerts(base({ sources: [okSource('calendars')], sourceHealth: health }));
    expect(r.triggers.map((t) => t.line).join(' ')).toMatch(/healthy again after 5 failed runs/);
    expect(r.newSourceHealth.calendars.alerting).toBeUndefined();
    expect(r.newSourceHealth.calendars.consecutiveFails).toBe(0);
  });

  it('recovery without a prior alert stays silent', () => {
    const health: Record<string, SourceHealth> = { calendars: { consecutiveFails: 2 } };
    const r = evaluateAlerts(base({ sources: [okSource('calendars')], sourceHealth: health }));
    expect(r.triggers).toHaveLength(0);
  });

  it('parity checks are tracked individually as rate:{source}', () => {
    const parity = [
      { source: 'expedia' as const, status: 'needs-manual-check' as const, fetchedAt: NOW },
      { source: 'booking' as const, status: 'ok' as const, price: 99, fetchedAt: NOW },
    ];
    const health: Record<string, SourceHealth> = { 'rate:expedia': { consecutiveFails: 2 } };
    const r = evaluateAlerts(base({ parity, sourceHealth: health }));
    expect(r.triggers.some((t) => t.line.includes('"rate:expedia"') && t.line.includes('3 consecutive'))).toBe(true);
    expect(r.newSourceHealth['rate:booking'].consecutiveFails).toBe(0);
  });

  it('broken-source alert dedupes within 24h but refires after (daily reminder)', () => {
    const health: Record<string, SourceHealth> = { nws: { consecutiveFails: 4, alerting: true } };
    const r1 = evaluateAlerts(base({ sources: [failing('nws')], sourceHealth: health }));
    expect(r1.triggers).toHaveLength(1);
    // same broken state 3h later — suppressed
    const later3h = '2026-07-12T15:00:00-05:00';
    const r2 = evaluateAlerts(base({
      sources: [failing('nws')], sourceHealth: r1.newSourceHealth, fingerprints: r1.newFingerprints, now: later3h,
    }));
    expect(r2.triggers).toHaveLength(0);
    // still broken 25h later — refires
    const later25h = '2026-07-13T13:30:00-05:00';
    const r3 = evaluateAlerts(base({
      sources: [failing('nws')], sourceHealth: r2.newSourceHealth, fingerprints: r2.newFingerprints, now: later25h,
    }));
    expect(r3.triggers).toHaveLength(1);
  });

  it('awaiting-key counts as failing (misconfiguration is a real outage)', () => {
    const health: Record<string, SourceHealth> = { ticketmaster: { consecutiveFails: 2 } };
    const r = evaluateAlerts(base({
      sources: [{ source: 'ticketmaster', status: 'awaiting-key' as const }], sourceHealth: health,
    }));
    expect(r.triggers.some((t) => t.type === 'source-health')).toBe(true);
  });
});
