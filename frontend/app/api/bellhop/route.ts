import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoSid, requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { requireRole } from '../../../../backend/lib/auth/guard';
import { todayIn } from '../../../../backend/lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../../backend/lib/bookings';
import { buildSystemPrompt } from '../../../../backend/lib/bellhop/context';
import { streamReply, type ReplyPart } from '../../../../backend/lib/bellhop/gemini';
import type { HistoryRecord, Snapshot } from '../../../../backend/lib/scoring/types';

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === 'user'),
});

const DEMO_REPLY =
  "Sorry, Bellhop can't be fully used in the demo. On the Growth plan it answers questions about your own hotel: why tonight's rate moved, what's on in town, and what your guests are asking about.";
const UNAVAILABLE = 'Bellhop is unavailable right now. The recommendations on the dashboard are unaffected.';

/** Every question spends model quota, so it is a POST behind the lowest role, not an open endpoint. */
export async function POST(req: Request) {
  const gate = await requireRole('viewer');
  if (!gate.ok) return gate.response;

  if (!gate.limits.bellhop) return NextResponse.json({ error: 'Bellhop is on the Growth plan' }, { status: 402 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  // The demo answers every question with an upgrade note, as a normal reply, so it spends no model quota.
  if (await demoSid()) {
    return new Response(DEMO_REPLY, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const store = await requestStore();
  const property = await requestProperty();

  const dates = ((await store.get<string[]>('history:dates')) ?? []).slice(0, 30);
  const [snapshot, actuals, bookings, history] = await Promise.all([
    store.get<Snapshot>('snapshot:latest'),
    store.get<Record<string, Record<string, number>>>('actuals'),
    store.get<Bookings>(BOOKINGS_KEY),
    Promise.all(dates.map((d) => store.hget<HistoryRecord>('history', d))),
  ]);
  const system = buildSystemPrompt({
    property,
    today: todayIn(property.timezone),
    snapshot,
    history: history.filter((h): h is HistoryRecord => h !== null),
    actuals: actuals ?? {},
    bookings: bookings ?? {},
  });

  let parts: AsyncGenerator<ReplyPart>;
  try {
    parts = await streamReply(system, parsed.data.messages, { search: true });
  } catch (err) {
    console.error('bellhop:', err);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // The answer as plain text, then, if it was searched, a record separator and its sources as JSON.
        for await (const part of parts)
          controller.enqueue(encoder.encode('text' in part ? part.text : `\x1e${JSON.stringify(part.grounding)}`));
      } catch (err) {
        console.error('bellhop stream:', err);
        controller.enqueue(encoder.encode(`\n\n${UNAVAILABLE}`));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
