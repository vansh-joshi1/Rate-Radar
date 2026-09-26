import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { requireRole } from '../../../../backend/lib/auth/guard';
import { recordTonight } from '../../../../backend/lib/bookings';

const Body = z.object({ rooms: z.number() });

/**
 * Tonight's rooms-booked count. The one write a viewer may make, on purpose:
 * the front desk knows tonight's bookings best. Tonight only — the date is
 * decided server-side — so this cannot touch pricing or any other night.
 */
export async function POST(req: Request) {
  const gate = await requireRole('viewer');
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const res = await recordTonight(await requestStore(), await requestProperty(), parsed.data.rooms);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
