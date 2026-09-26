import { NextResponse } from 'next/server';
import { BundleSchema, processBundle } from '../../../../backend/lib/ingest';
import { getStore, storeFor } from '../../../../backend/lib/store';
import { DEFAULT_PROPERTY_ID, loadProperty } from '../../../../backend/lib/properties';

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
    const property = await loadProperty(getStore(), parsed.data.propertyId ?? DEFAULT_PROPERTY_ID);
    if (!property) return NextResponse.json({ error: `unknown property ${parsed.data.propertyId}` }, { status: 400 });
    const summary = await processBundle(parsed.data, storeFor(property.id), new Date(), property);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[ingest] failed:', err);
    return NextResponse.json({ error: 'ingest failed', detail: String(err) }, { status: 500 });
  }
}
