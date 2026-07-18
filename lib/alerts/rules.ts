import type { NightRecommendation, RateCheck, SourceResult, WeatherAlert } from '../scoring/types';

export interface HolidayEntry {
  name: string;
  date: string;
  drawProfile: string;
}

export interface Trigger {
  type: 'rate-change' | 'parity-gap' | 'new-event' | 'weather' | 'holiday' | 'source-health';
  date?: string;
  /** The final one-line sentence used in the email. */
  line: string;
}

/** Consecutive-failure tracking per data source (and per parity check as `rate:{source}`). */
export interface SourceHealth {
  consecutiveFails: number;
  lastOkAt?: string;
  /** True once the broken-source alert has fired — drives the recovery notice. */
  alerting?: boolean;
}

export interface AlertInput {
  nights: NightRecommendation[];
  parity: RateCheck[];
  weatherAlerts: WeatherAlert[];
  holidays: HolidayEntry[];
  /** date → last-emailed recommended rate (standard tier). */
  prevEmailed: Record<string, number>;
  /** fingerprint → ISO timestamp last sent. */
  fingerprints: Record<string, string>;
  seenEventIds: string[];
  now: string;
  /** Collector source results this run (optional — omitted by older callers/tests). */
  sources?: Pick<SourceResult, 'source' | 'status'>[];
  /** Prior consecutive-failure state, keyed by source name. */
  sourceHealth?: Record<string, SourceHealth>;
}

export interface AlertResult {
  triggers: Trigger[];
  newFingerprints: Record<string, string>;
  newEmailedState: Record<string, number>;
  newSeenEventIds: string[];
  newSourceHealth: Record<string, SourceHealth>;
}

// Thresholds (see design spec — normative)
const RATE_DELTA_USD = 5;
const RATE_DELTA_PCT = 7;
const PARITY_GAP_USD = 8;
const PARITY_GAP_PCT = 10;
const NEW_EVENT_MIN_SCORE = 40;
const HOLIDAY_LOOKAHEAD_DAYS = 14;
const DEDUPE_HOURS = 24;
// ~half a day at 7 runs/day — one bot-blocked run is noise, three in a row is a broken source.
const SOURCE_FAIL_THRESHOLD = 3;
const SEVERE = new Set(['Severe', 'Extreme']);

function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function bucket(value: number, size: number): number {
  return Math.round(value / size);
}

export function evaluateAlerts(input: AlertInput): AlertResult {
  const triggers: Trigger[] = [];
  const newFingerprints = { ...input.fingerprints };
  const newEmailedState = { ...input.prevEmailed };
  const newSeenEventIds = [...input.seenEventIds];
  const nowMs = new Date(input.now).getTime();

  const isFresh = (fp: string): boolean => {
    const last = newFingerprints[fp];
    return last !== undefined && nowMs - new Date(last).getTime() < DEDUPE_HOURS * 3600_000;
  };
  const fire = (fp: string, t: Trigger): void => {
    if (isFresh(fp)) return;
    newFingerprints[fp] = input.now;
    triggers.push(t);
  };

  // 1) Rate change vs last-EMAILED state (not last run — prevents drip alerts)
  const firstEver = Object.keys(input.prevEmailed).length === 0;
  for (const n of input.nights) {
    const std = n.tiers.find((t) => t.tierId === 'standard');
    if (!std) continue;
    const prev = input.prevEmailed[n.date];
    if (prev !== undefined && !firstEver) {
      const delta = Math.abs(std.recommended - prev);
      if (delta >= RATE_DELTA_USD || (delta / prev) * 100 >= RATE_DELTA_PCT) {
        const driver = n.events.filter((e) => e.score >= NEW_EVENT_MIN_SCORE)[0];
        fire(`rate:${n.date}:${bucket(std.recommended, RATE_DELTA_USD)}`, {
          type: 'rate-change',
          date: n.date,
          line: `${fmtDate(n.date)}: recommended $${std.recommended} (was $${prev})${driver ? ` — ${driver.name}, ${driver.verdict.toLowerCase()}` : ''}.`,
        });
        newEmailedState[n.date] = std.recommended;
      }
    } else {
      newEmailedState[n.date] = std.recommended; // seed baseline silently
    }
  }

  // 2) Parity gap across sources that actually reported a price.
  // Google Hotels is excluded by owner request (its "official site" rate is a
  // Google-side artifact) — shown on the dashboard as informational only.
  const priced = input.parity.filter(
    (p) => p.status === 'ok' && typeof p.price === 'number' && p.source !== 'google'
  );
  if (priced.length >= 2) {
    const lo = priced.reduce((a, b) => (a.price! <= b.price! ? a : b));
    const hi = priced.reduce((a, b) => (a.price! >= b.price! ? a : b));
    const gap = hi.price! - lo.price!;
    if (gap >= PARITY_GAP_USD || (gap / lo.price!) * 100 >= PARITY_GAP_PCT) {
      fire(`parity:${bucket(gap, 4)}`, {
        type: 'parity-gap',
        line: `Rate parity gap: ${lo.source} shows $${lo.price} but ${hi.source} shows $${hi.price} ($${gap} spread) — worth checking listings.`,
      });
    }
  }

  // 3) New meaningful event (first detection at score >= 40)
  for (const n of input.nights) {
    for (const e of n.events) {
      if (e.score >= NEW_EVENT_MIN_SCORE && !input.seenEventIds.includes(e.id)) {
        newSeenEventIds.push(e.id);
        fire(`event:${e.id}`, {
          type: 'new-event',
          date: n.date,
          line: `New demand driver ${fmtDate(n.date)}: ${e.name} at ${e.venue} (score ${e.score})${e.verdict ? ` — ${e.verdict.toLowerCase()}` : ''}.`,
        });
      }
    }
  }

  // 4) Severe weather
  for (const w of input.weatherAlerts) {
    if (SEVERE.has(w.severity)) {
      fire(`weather:${w.event}:${w.area}`, {
        type: 'weather',
        line: `${w.event} (${w.severity}) for ${w.area}: ${w.headline}${w.isWinter ? ' — winter weather can INCREASE short-notice demand (stranded travelers).' : ''}`,
      });
    }
  }

  // 5) Source health: N consecutive failed runs → alert (refires daily via the
  // 24h dedupe while broken), plus a one-line recovery notice. Parity checks
  // are tracked individually as `rate:{source}` — the `rates` source result is
  // "ok" even when every individual check came back needs-manual-check.
  const newSourceHealth: Record<string, SourceHealth> = {};
  const observations: { name: string; ok: boolean }[] = [
    ...(input.sources ?? []).map((s) => ({ name: s.source, ok: s.status === 'ok' })),
    ...input.parity.map((p) => ({ name: `rate:${p.source}`, ok: p.status === 'ok' })),
  ];
  for (const { name, ok } of observations) {
    const prev = input.sourceHealth?.[name] ?? { consecutiveFails: 0 };
    if (ok) {
      if (prev.alerting) {
        fire(`source-recovered:${name}`, {
          type: 'source-health',
          line: `Data source "${name}" is healthy again after ${prev.consecutiveFails} failed runs.`,
        });
      }
      newSourceHealth[name] = { consecutiveFails: 0, lastOkAt: input.now };
    } else {
      const fails = prev.consecutiveFails + 1;
      const health: SourceHealth = { ...prev, consecutiveFails: fails };
      if (fails >= SOURCE_FAIL_THRESHOLD) {
        health.alerting = true;
        fire(`source-health:${name}`, {
          type: 'source-health',
          line: `Data source "${name}" has failed ${fails} consecutive runs${prev.lastOkAt ? ` (last good data ${prev.lastOkAt.slice(0, 10)})` : ''} — its data is going stale; the scraper/selectors may need a refresh.`,
        });
      }
      newSourceHealth[name] = health;
    }
  }

  // 6) Holiday within 14 days, flagged once
  for (const h of input.holidays) {
    const days = (new Date(`${h.date}T12:00:00Z`).getTime() - nowMs) / 86400_000;
    if (days >= 0 && days <= HOLIDAY_LOOKAHEAD_DAYS) {
      fire(`holiday:${h.name}:${h.date}`, {
        type: 'holiday',
        date: h.date,
        line: `${h.name} is coming up (${fmtDate(h.date)}) — expect ${h.drawProfile} travel demand.`,
      });
    }
  }

  return { triggers, newFingerprints, newEmailedState, newSeenEventIds, newSourceHealth };
}
