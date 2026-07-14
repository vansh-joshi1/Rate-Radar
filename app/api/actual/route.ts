import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '../../../lib/store';

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tierId: z.enum(['standard', 'superior']),
  rate: z.number().min(20).max(1000),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const store = getStore();
  const actuals = (await store.get<Record<string, Record<string, number>>>('actuals')) ?? {};
  (actuals[parsed.data.date] ??= {})[parsed.data.tierId] = parsed.data.rate;
  await store.set('actuals', actuals);
  return NextResponse.json({ ok: true });
}
