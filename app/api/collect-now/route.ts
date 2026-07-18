import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Kick off a real collection run by dispatching the GitHub Actions workflow.
 * Needs a fine-grained PAT with Actions read/write on the repo, set in Vercel
 * as GITHUB_DISPATCH_TOKEN (optional — without it, callers fall back to the
 * schedule). Session-gated by the middleware.
 */
export async function POST() {
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
