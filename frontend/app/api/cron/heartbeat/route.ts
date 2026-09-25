import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../../../backend/lib/store';
import type { Snapshot } from '../../../../../backend/lib/scoring/types';
import { pipelineStaleEmail, type EmailMessage } from '../../../../../backend/lib/email/messages';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Daily Vercel-cron heartbeat — the independent second leg of scheduling.
 * GitHub auto-disables scheduled workflows after 60 days of repo inactivity
 * (which silences the watchdog too); this endpoint runs on Vercel's scheduler,
 * checks data freshness, and if the pipeline looks dead it re-triggers the
 * collect workflow via workflow_dispatch — which GitHub honors even when
 * scheduled triggers are disabled. If the trigger itself fails, it emails.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var
 * exists. Middleware excludes this path; the check below is the gate.
 */

/**
 * Must exceed the longest normal gap between collections, which is the
 * overnight 13:00 → 07:00 CT stretch (18h). At the old value of 4 this fired a
 * rescue dispatch every single night — and now that a run costs SerpApi
 * searches from a 250/month budget, a nightly phantom run is not just noise.
 */
const STALE_HOURS = 20;

async function alertByEmail({ subject, html, text }: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Rate Radar <onboarding@resend.dev>',
      to: to.split(',').map((s) => s.trim()),
      subject,
      html,
      text,
    }),
  }).catch(() => undefined);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset secret would let anyone trigger collections and burn SerpApi quota.
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const snapshot = await getStore().get<Snapshot>('snapshot:latest');
  const ageHours = snapshot ? (Date.now() - new Date(snapshot.runAt).getTime()) / 3600_000 : Infinity;
  if (ageHours < STALE_HOURS) {
    return NextResponse.json({ ok: true, ageHours: Math.round(ageHours * 10) / 10 });
  }

  // Pipeline looks dead — try to revive it.
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? 'vansh-joshi1/Rate-Radar';
  let dispatched = false;
  if (token) {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main' }),
    }).catch(() => null);
    dispatched = res?.status === 204;
  }

  if (!dispatched) {
    await alertByEmail(
      pipelineStaleEmail({
        ageHours,
        staleAfterHours: STALE_HOURS,
        reason: token
          ? 'GitHub rejected the dispatch. Check that GITHUB_DISPATCH_TOKEN still has workflow permission and has not expired.'
          : 'GITHUB_DISPATCH_TOKEN is not set, so the heartbeat has no way to start the workflow.',
        actionsUrl: `https://github.com/${repo}/actions`,
        origin: process.env.DASHBOARD_URL ?? req.nextUrl.origin,
      })
    );
    return NextResponse.json({ ok: false, ageHours: Math.round(ageHours * 10) / 10, dispatched, alerted: true }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revived: true, ageHours: Math.round(ageHours * 10) / 10 });
}
