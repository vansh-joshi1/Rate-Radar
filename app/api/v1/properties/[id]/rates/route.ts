import { propertyContext, provenance } from '../../../../../../lib/api/context';
import { envelope } from '../../../../../../lib/api/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/:id/rates — the property's own listed rate per source
 * (rate parity). Sources that could not be read this run are returned with
 * status "needs-manual-check" rather than omitted — absence of a price is
 * information, not an error.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await propertyContext(req, params.id);
  if (ctx instanceof Response) return ctx;

  const checks = ctx.snapshot.parity.map((p) => ({
    source: p.source,
    status: p.status,
    price: p.price ?? null,
    currency: 'USD',
    room: p.room ?? null,
    fetchedAt: p.fetchedAt,
    note: p.source === 'google' ? 'informational only — excluded from parity gap' : null,
    error: p.error ?? null,
  }));

  const priced = checks.filter((c) => c.status === 'ok' && c.price != null && c.source !== 'google');
  const gap =
    priced.length >= 2
      ? Math.max(...priced.map((c) => c.price!)) - Math.min(...priced.map((c) => c.price!))
      : null;

  return Response.json(envelope({ checks, parityGapUsd: gap }, provenance(ctx)));
}
