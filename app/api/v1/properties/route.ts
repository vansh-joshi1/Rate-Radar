import { getStore } from '../../../../lib/store';
import { PROPERTIES } from '../../../../lib/properties';
import { authenticate, canReadProperty, envelope, apiError } from '../../../../lib/api/auth';
import { loadPropertySnapshot } from '../../../../lib/api/context';

export const dynamic = 'force-dynamic';

/** GET /api/v1/properties — the hotels this key can read, with data freshness. */
export async function GET(req: Request) {
  const store = getStore();
  const auth = await authenticate(req, store);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const visible = PROPERTIES.filter((p) => canReadProperty(auth.record, p.id));
  const data = await Promise.all(
    visible.map(async (p) => {
      const snap = await loadPropertySnapshot(store, p.id);
      return {
        id: p.id,
        name: p.name,
        city: p.city,
        timezone: p.timezone,
        hasData: snap !== null,
        lastRunAt: snap?.runAt ?? null,
        confidence: snap?.confidence ?? null,
      };
    })
  );
  return Response.json(envelope(data, { count: data.length }));
}
