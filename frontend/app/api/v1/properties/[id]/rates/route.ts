import { propertyContext, provenance } from '../../../../../../../backend/lib/api/context';
import { envelope } from '../../../../../../../backend/lib/api/auth';
import { loadCurrentRates } from '../../../../../../../backend/lib/current-rates';
import { trackedParity, CHANNEL_POLICY } from '../../../../../../../backend/lib/parity/channels';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/:id/rates — the property's own listed rate per source
 * (rate parity). Sources that could not be read this run are returned with
 * status "needs-manual-check" rather than omitted — absence of a price is
 * information, not an error.
 *
 * Only the tracked channels are reported (see lib/parity/channels.ts), and
 * `parityGapUsd` is the spread across those same channels, so the figure
 * always matches the rows beside it. `meta.channelPolicy` names the rule, so
 * a consumer can tell three-of-many from three-of-three.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await propertyContext(req, params.id);
  if (ctx instanceof Response) return ctx;

  const checks = trackedParity(ctx.snapshot.parity).map((p) => ({
    source: p.source,
    official: p.official ?? false,
    status: p.status,
    price: p.price ?? null,
    currency: 'USD',
    room: p.room ?? null,
    rooms: p.rooms ?? null,
    fetchedAt: p.fetchedAt,
    note: null,
    error: p.error ?? null,
  }));

  const priced = checks.filter((c) => c.status === 'ok' && c.price != null);
  const gap =
    priced.length >= 2
      ? Math.max(...priced.map((c) => c.price!)) - Math.min(...priced.map((c) => c.price!))
      : null;

  // Your rate: owner-entered is authoritative (the owner sets prices); the
  // scraped direct rate fills in otherwise. Market position compares it
  // lead-vs-lead against the compset — room types don't match across brands.
  const owner = await loadCurrentRates(ctx.store, ctx.property.id);
  const ownerStandard = owner?.tiers['standard'] ?? null;
  const direct = checks.find((c) => c.official && c.status === 'ok')?.price ?? null;
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

  return Response.json(
    envelope(
      { checks, parityGapUsd: gap, currentRate, marketPosition },
      // Only this endpoint returns parity, so the policy is stated here rather
      // than in the shared provenance block every v1 endpoint carries.
      { ...provenance(ctx), channelPolicy: CHANNEL_POLICY },
    ),
  );
}
