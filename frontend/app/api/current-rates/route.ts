import { NextResponse, type NextRequest } from 'next/server';
import { loadCurrentRates, saveCurrentRates, validateCurrentRates } from '../../../../backend/lib/current-rates';
import { propertyFromRequest } from '../../../../backend/lib/api/property-request';
import { requireRole } from '../../../../backend/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * The rates the property is actually listing right now — the authoritative
 * "your rate" every comparison is drawn against. Readable by any member,
 * writable by manager+.
 */

export async function GET(req: NextRequest) {
  const target = await propertyFromRequest(req);
  if (!target.ok) return target.response;
  const rates = await loadCurrentRates(target.store, target.propertyId);
  return NextResponse.json({ propertyId: target.propertyId, rates });
}

export async function PUT(req: NextRequest) {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const target = await propertyFromRequest(req);
  if (!target.ok) return target.response;

  const body = (await req.json().catch(() => null)) as { tiers?: Record<string, number> } | null;
  if (!body?.tiers) return NextResponse.json({ error: 'body must be { tiers: { tierId: rate } }' }, { status: 400 });

  const problem = validateCurrentRates(body.tiers);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const rates = { tiers: body.tiers, updatedAt: new Date().toISOString() };
  await saveCurrentRates(target.store, target.propertyId, rates);
  return NextResponse.json({ ok: true, rates });
}
