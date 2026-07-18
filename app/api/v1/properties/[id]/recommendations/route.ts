import { propertyContext, provenance } from '../../../../../../lib/api/context';
import { envelope, apiError } from '../../../../../../lib/api/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/:id/recommendations[?nights=N] — per-night rate
 * recommendations with the full reasoning and every considered event,
 * including the ones judged too small to matter.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await propertyContext(req, params.id);
  if (ctx instanceof Response) return ctx;

  const raw = new URL(req.url).searchParams.get('nights');
  const nights = raw ? Number(raw) : ctx.snapshot.nights.length;
  if (!Number.isInteger(nights) || nights < 1 || nights > ctx.snapshot.nights.length) {
    return apiError(400, 'bad_nights', `nights must be an integer 1–${ctx.snapshot.nights.length}.`);
  }

  const data = ctx.snapshot.nights.slice(0, nights).map((n) => ({
    date: n.date,
    nightScore: n.nightScore,
    upliftPct: n.upliftPct,
    holiday: n.holidayName ?? null,
    tiers: n.tiers.map((t) => ({
      tierId: t.tierId,
      label: t.label,
      recommended: t.recommended,
      range: t.range,
      currency: 'USD',
    })),
    events: n.events.map((e) => ({
      name: e.name,
      venue: e.venue,
      score: e.score,
      tier: e.tier,
      verdict: e.verdict,
    })),
    reasoning: n.reasoning,
  }));
  return Response.json(envelope(data, provenance(ctx)));
}
