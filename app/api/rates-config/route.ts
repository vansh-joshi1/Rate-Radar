import { NextResponse, type NextRequest } from 'next/server';
import { requestStore } from '../../../lib/demo/context';
import { loadRatesConfig, saveRatesConfig, validateRatesConfig, type RatesConfig } from '../../../lib/rates-config';
import { propertyFromRequest } from '../../../lib/api/property-request';
import { requireRole } from '../../../lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * Per-property baseline rates (Settings → Property). Any signed-in member may
 * read them; changing them is manager+ — the baseline table is the floor every
 * recommendation is computed from. Edits apply on the next collection run.
 */

export async function GET(req: NextRequest) {
  const target = propertyFromRequest(req);
  if (!target.ok) return target.response;
  const config = await loadRatesConfig(requestStore(), target.propertyId);
  return NextResponse.json({ propertyId: target.propertyId, config });
}

export async function PUT(req: NextRequest) {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const target = propertyFromRequest(req);
  if (!target.ok) return target.response;

  const body = (await req.json().catch(() => null)) as { config?: RatesConfig } | null;
  if (!body?.config) return NextResponse.json({ error: 'body must be { config }' }, { status: 400 });

  const problem = validateRatesConfig(body.config);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await saveRatesConfig(requestStore(), target.propertyId, body.config);
  return NextResponse.json({ ok: true, config: body.config });
}
