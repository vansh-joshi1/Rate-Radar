/**
 * Per-attempt collection telemetry.
 *
 * Before this existed, a bot-walled check, a hotel with no resolved Booking
 * URL, and a hotel with genuinely no availability all produced the same
 * thing: a missing entry and a console.warn that died with the Actions log.
 * That made "how much of this is blocking?" unanswerable — which is the one
 * question that decides what to build next. Hence these outcomes.
 */

export type AttemptOutcome =
  | 'ok'
  | 'blocked'
  | 'no-price'
  | 'timeout'
  | 'unresolved'
  | 'sanity-rejected'
  | 'error';

export type AttemptSource = 'redroof' | 'google' | 'expedia' | 'booking' | 'booking-direct';

export interface AttemptRecord {
  /** 'ours' for our own property, 'harvest' for aggregation pages, else the watchlist hotel name. */
  target: 'ours' | 'harvest' | string;
  source: AttemptSource;
  /** Check-in night the attempt priced, YYYY-MM-DD. */
  date: string;
  outcome: AttemptOutcome;
  attempts: number;
  durationMs: number;
}

export interface RunTelemetry {
  runAt: string;
  /** Which scheduling leg ran this. */
  runLeg: 'self-hosted' | 'github-hosted';
  /** Distinguishes baseline runs from post-swap runs. */
  browser: 'playwright' | 'patchright';
  /** Runs since the browser profile was created or rotated. 0 when fresh. */
  profileAgeRuns: number;
  attempts: AttemptRecord[];
}

export function classifyOutcome(input: {
  result: { price: number } | null;
  error: string | null;
  sanityRejected?: boolean;
}): AttemptOutcome {
  const { result, error, sanityRejected = false } = input;
  // Checked before result: a bot wall invalidates whatever happened to render.
  if (error && /blocked by a bot check|verify you are a human|unusual traffic|captcha/i.test(error)) {
    return 'blocked';
  }
  if (error && /timeout|timed out/i.test(error)) return 'timeout';
  if (error) return 'error';
  if (sanityRejected) return 'sanity-rejected';
  if (!result) return 'no-price';
  return 'ok';
}

/**
 * Run-scoped buffer. Module-level and reset per run, matching the existing
 * `compsetHarvest` pattern in sources/rates.ts — the collector is a
 * single-run process, so this is simpler than threading a context object
 * through every checker.
 */
let buffer: AttemptRecord[] = [];

export function resetTelemetry(): void {
  buffer = [];
}

export function record(r: AttemptRecord): void {
  buffer.push(r);
}

export function buildRunTelemetry(ctx: Omit<RunTelemetry, 'attempts'>): RunTelemetry {
  return { ...ctx, attempts: [...buffer] };
}

export interface OutcomeCounts {
  ok: number;
  blocked: number;
  'no-price': number;
  timeout: number;
  unresolved: number;
  'sanity-rejected': number;
  error: number;
}

export interface TelemetrySummary {
  total: number;
  ok: number;
  /** Blocked attempts over total. The number this whole phase exists to move. */
  blockedShare: number;
  bySource: Record<string, OutcomeCounts>;
}

const zeroCounts = (): OutcomeCounts => ({
  ok: 0,
  blocked: 0,
  'no-price': 0,
  timeout: 0,
  unresolved: 0,
  'sanity-rejected': 0,
  error: 0,
});

export function summarize(attempts: AttemptRecord[]): TelemetrySummary {
  const bySource: Record<string, OutcomeCounts> = {};
  let ok = 0;
  let blocked = 0;
  for (const a of attempts) {
    bySource[a.source] ??= zeroCounts();
    bySource[a.source][a.outcome] += 1;
    if (a.outcome === 'ok') ok += 1;
    if (a.outcome === 'blocked') blocked += 1;
  }
  return {
    total: attempts.length,
    ok,
    blockedShare: attempts.length === 0 ? 0 : blocked / attempts.length,
    bySource,
  };
}
