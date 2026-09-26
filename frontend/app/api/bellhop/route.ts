import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoSid, requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { requireRole } from '../../../../backend/lib/auth/guard';
import { todayIn } from '../../../../backend/lib/date';
import { BOOKINGS_KEY, type Bookings } from '../../../../backend/lib/bookings';
import { buildSystemPrompt } from '../../../../backend/lib/bellhop/context';
import { streamReply } from '../../../../backend/lib/bellhop/gemini';
import type { HistoryRecord, Snapshot } from '../../../../backend/lib/scoring/types';

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === 'user'),
});

const DEMO_DAILY_QUESTIONS = 10;
const UNAVAILABLE = 'Bellhop is unavailable right now. The recommendations on the dashboard are unaffected.';

/** Every question spends model quota, so it is a POST behind the lowest role, not an open endpoint. */
export async function POST(req: Request) {
  const gate = await requireRole('viewer');
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const store = await requestStore();
  const property = await requestProperty();

  // The public demo spends the real key's quota. The counter lives in the
  // sandbox (it expires with it), so this is per sandbox per day.
  // ponytail: a visitor who clears cookies gets a fresh sandbox and a fresh 10; add an IP limit if the demo gets abused.
  if (demoSid() && (await store.incr('bellhop:asked', 86400)) > DEMO_DAILY_QUESTIONS) {
    return NextResponse.json(
      { error: `The demo allows ${DEMO_DAILY_QUESTIONS} Bellhop questions a day. The real product has no such cap.` },
      { status: 429 }
    );
  }

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

  let chunks: AsyncGenerator<string>;
  try {
    chunks = await streamReply(system, parsed.data.messages);
  } catch (err) {
    console.error('bellhop:', err);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
      } catch (err) {
        console.error('bellhop stream:', err);
        controller.enqueue(encoder.encode(`\n\n${UNAVAILABLE}`));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
