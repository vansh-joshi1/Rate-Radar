import { NextResponse, type NextRequest } from 'next/server';
import { startSharedSession } from '../../../../../backend/auth';
import { getStore } from '../../../../../backend/lib/store';

/** The shared site password → the shared front-desk session (owner role). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if ((await getStore().incr(`site-password:${ip}:${Math.floor(Date.now() / 60_000)}`, 90)) > 10) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.SITE_PASSWORD;
  if (!expected || password !== expected) return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  if (!(await startSharedSession())) return NextResponse.json({ error: 'could not start session' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
