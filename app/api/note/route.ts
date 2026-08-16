import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '../../../lib/store';
import { requireRole } from '../../../lib/auth/guard';

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().max(2000) });

/** Notes feed the reasoning a human reads before pricing a night — manager+. */
export async function POST(req: Request) {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  await getStore().hset('notes', parsed.data.date, parsed.data.text);
  return NextResponse.json({ ok: true });
}
