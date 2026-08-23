import { NextResponse } from 'next/server';
import { requireRole } from '../../../lib/auth/guard';
import { getStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

/**
 * Minimum gap between manual runs. A run spends SerpApi searches out of a
 * 250/month budget, and a manual dispatch skips the workflow's freshness gate
 * entirely, so this endpoint is the only thing standing between an impatient
 * click and the month's quota. The collector's own budget tier degrades under
 * repeated runs too — this just keeps the pace sane.
 */
const THROTTLE_SECONDS = 15 * 60;

/**
 * Kick off a real collection run by dispatching the GitHub Actions workflow.
 * Needs a fine-grained PAT with Actions read/write on the repo, set in Vercel
 * as GITHUB_DISPATCH_TOKEN (optional — without it, callers fall back to the
 * schedule). Manager+ — it spends CI minutes and metered API searches.
 */
export async function POST() {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const attempts = await getStore().incr('collect-now:throttle', THROTTLE_SECONDS);
  if (attempts > 1) {
    return NextResponse.json(
      {
        error: 'too soon',
        hint: 'A collection run was already triggered in the last 15 minutes. Each run spends metered API searches, so give it a moment.',
      },
      { status: 429 }
    );
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? 'vansh-joshi1/Rate-Radar';
  if (!token) {
    return NextResponse.json(
      {
        error: 'not configured',
        hint: 'Set GITHUB_DISPATCH_TOKEN in Vercel (fine-grained PAT, Actions read/write) to enable on-demand collection runs.',
      },
      { status: 501 }
    );
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  });

  if (res.status === 204) return NextResponse.json({ ok: true, message: 'Collection run triggered — new data in ~5–10 minutes.' });
  const detail = await res.text().catch(() => '');
  console.error('[collect-now] dispatch failed:', res.status, detail.slice(0, 300));
  return NextResponse.json({ error: `GitHub dispatch failed (${res.status})` }, { status: 502 });
}
