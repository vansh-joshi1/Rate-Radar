import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { loadRatesConfig, saveRatesConfig, validateRatesConfig, type RatesConfig } from '../../../lib/rates-config';
import { requireRole } from '../../../lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * Per-property baseline rates (Settings → Property). Any signed-in member may
 * read them; changing them is manager+ — the baseline table is the floor every
 * recommendation is computed from. Edits apply on the next collection run.
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
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const propertyId = propertyIdFrom(req);
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { config?: RatesConfig } | null;
  if (!body?.config) return NextResponse.json({ error: 'body must be { config }' }, { status: 400 });

  const problem = validateRatesConfig(body.config);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await saveRatesConfig(getStore(), propertyId, body.config);
  return NextResponse.json({ ok: true, config: body.config });
}
