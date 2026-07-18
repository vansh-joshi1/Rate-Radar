import { propertyContext, provenance } from '../../../../../../lib/api/context';
import { envelope } from '../../../../../../lib/api/auth';
import { loadCurrentRates } from '../../../../../../lib/current-rates';

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
    rooms: p.rooms ?? null,
    fetchedAt: p.fetchedAt,
    note: p.source === 'google' ? 'informational only — excluded from parity gap' : null,
    error: p.error ?? null,
  }));

  const priced = checks.filter((c) => c.status === 'ok' && c.price != null && c.source !== 'google');
  const gap =
    priced.length >= 2
      ? Math.max(...priced.map((c) => c.price!)) - Math.min(...priced.map((c) => c.price!))
      : null;

  // Your rate: owner-entered is authoritative (the owner sets prices); the
  // scraped direct rate fills in otherwise. Market position compares it
  // lead-vs-lead against the compset — room types don't match across brands.
  const owner = await loadCurrentRates(ctx.store, ctx.property.id);
  const ownerStandard = owner?.tiers['standard'] ?? null;
  const direct = checks.find((c) => c.source === 'redroof' && c.status === 'ok')?.price ?? null;
  const yourRate = ownerStandard ?? direct;
  const currentRate =
    yourRate != null
      ? {
          price: yourRate,
          source: ownerStandard != null ? ('owner-entered' as const) : ('scraped-direct' as const),
          updatedAt: ownerStandard != null ? owner!.updatedAt : null,
        }
      : null;

  const block = (ctx.snapshot.compsets ?? []).find((c) => c.entries.length > 0);
  const marketPosition =
    yourRate != null && block
      ? {
          leadRate: yourRate,
          leadRateSource: currentRate!.source,
          compsetDate: block.date,
          rank: block.entries.filter((e) => e.price < yourRate).length + 1,
          of: block.entries.length + 1,
          median: block.median,
          vsMedianPct: block.median ? Math.round(((yourRate - block.median) / block.median) * 100) : null,
        }
      : null;

  return Response.json(envelope({ checks, parityGapUsd: gap, currentRate, marketPosition }, provenance(ctx)));
}
