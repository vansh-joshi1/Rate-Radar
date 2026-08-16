import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { loadCurrentRates, saveCurrentRates, validateCurrentRates } from '../../../lib/current-rates';
import { requireRole } from '../../../lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * The rates the property is actually listing right now — the authoritative
 * "your rate" every comparison is drawn against. Readable by any member,
 * writable by manager+.
 */

function propertyIdFrom(req: NextRequest): string {
  return new URL(req.url).searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
}

export async function GET(req: NextRequest) {
  const propertyId = propertyIdFrom(req);
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });
  const rates = await loadCurrentRates(getStore(), propertyId);
  return NextResponse.json({ propertyId, rates });
}

export async function PUT(req: NextRequest) {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const propertyId = propertyIdFrom(req);
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { tiers?: Record<string, number> } | null;
  if (!body?.tiers) return NextResponse.json({ error: 'body must be { tiers: { tierId: rate } }' }, { status: 400 });

  const problem = validateCurrentRates(body.tiers);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const rates = { tiers: body.tiers, updatedAt: new Date().toISOString() };
  await saveCurrentRates(getStore(), propertyId, rates);
  return NextResponse.json({ ok: true, rates });
}
