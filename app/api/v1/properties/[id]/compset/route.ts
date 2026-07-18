import { propertyContext, provenance } from '../../../../../../lib/api/context';
import { envelope, apiError } from '../../../../../../lib/api/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/:id/compset[?date=YYYY-MM-DD] — competitor prices per
 * night. Without ?date, every compset the latest run captured is returned.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await propertyContext(req, params.id);
  if (ctx instanceof Response) return ctx;

  const date = new URL(req.url).searchParams.get('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError(400, 'bad_date', 'date must be YYYY-MM-DD.');
  }

  const all = ctx.snapshot.compsets ?? (ctx.snapshot.compset ? [ctx.snapshot.compset] : []);
  const selected = date ? all.filter((c) => c.date === date) : all;
  if (date && selected.length === 0) {
    return apiError(404, 'no_compset', `No compset captured for ${date} in the latest run.`);
  }

  const data = selected.map((c) => ({
    date: c.date,
    median: c.median,
    currency: 'USD',
    hotels: [...c.entries].sort((a, b) => a.price - b.price),
  }));
  return Response.json(envelope(data, provenance(ctx)));
}
