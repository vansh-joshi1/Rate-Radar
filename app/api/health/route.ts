import { NextResponse } from 'next/server';
import { getStore } from '../../../lib/store';
import type { Snapshot } from '../../../lib/scoring/types';

export const dynamic = 'force-dynamic';

const STALE_HOURS = 24;

/**
 * Public liveness probe for the whole pipeline — no auth, no sensitive data,
 * just "when did data last arrive". Returns 503 when no snapshot has landed
 * in 24h so a dumb `curl -f` (the watchdog workflow) fails loudly. This is
 * the guard against the failure mode nothing else can catch: the collector
 * silently not running at all (e.g. GitHub disabling stale cron schedules).
 */
export async function GET() {
  const snapshot = await getStore().get<Snapshot>('snapshot:latest');
  if (!snapshot) {
    return NextResponse.json({ ok: false, reason: 'no snapshot yet' }, { status: 503 });
  }
  const ageHours = (Date.now() - new Date(snapshot.runAt).getTime()) / 3600_000;
  const ok = ageHours < STALE_HOURS;
  return NextResponse.json(
    { ok, lastRunAt: snapshot.runAt, ageHours: Math.round(ageHours * 10) / 10 },
    { status: ok ? 200 : 503 }
  );
}
