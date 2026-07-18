import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { loadRatesConfig, saveRatesConfig, validateRatesConfig, type RatesConfig } from '../../../lib/rates-config';

export const dynamic = 'force-dynamic';

/**
 * Per-property baseline rates (Settings → Property). Session-gated by the
 * middleware like the other dashboard APIs. Edits apply on the next
 * collection run — recommendations are computed at ingest time.
 */

function propertyIdFrom(req: NextRequest): string {
  return new URL(req.url).searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
}

export async function GET(req: NextRequest) {
  const propertyId = propertyIdFrom(req);
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });
  const config = await loadRatesConfig(getStore(), propertyId);
  return NextResponse.json({ propertyId, config });
}

export async function PUT(req: NextRequest) {
  const propertyId = propertyIdFrom(req);
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { config?: RatesConfig } | null;
  if (!body?.config) return NextResponse.json({ error: 'body must be { config }' }, { status: 400 });

  const problem = validateRatesConfig(body.config);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await saveRatesConfig(getStore(), propertyId, body.config);
  return NextResponse.json({ ok: true, config: body.config });
}
