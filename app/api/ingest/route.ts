import { NextResponse } from 'next/server';
import { BundleSchema, processBundle } from '../../../lib/ingest';
import { getStore } from '../../../lib/store';

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.INGEST_SECRET || auth !== `Bearer ${process.env.INGEST_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = BundleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid bundle', detail: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const summary = await processBundle(parsed.data, getStore());
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[ingest] failed:', err);
    return NextResponse.json({ error: 'ingest failed', detail: String(err) }, { status: 500 });
  }
}
