import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { processBundle, type Bundle } from '../../../lib/ingest';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Re-run scoring on the LAST collected bundle with the CURRENT store configs
 * (baselines, watchlist). Instant effect for config edits — no scraping, so
 * new watchlist hotels won't gain prices here (that needs a real collection).
 * The snapshot keeps the bundle's original runAt, so data-freshness stays
 * honest; alert rules run too (24h fingerprints prevent duplicate emails).
 * Session-gated by the middleware.
 */
export async function POST(req: NextRequest) {
  const propertyId = new URL(req.url).searchParams.get('propertyId') ?? DEFAULT_PROPERTY_ID;
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  const store = getStore();
  const bundle = await store.get<Bundle>(`prop:${propertyId}:bundle:latest`);
  if (!bundle) {
    return NextResponse.json(
      { error: 'no collected bundle yet — changes apply on the next collection run' },
      { status: 404 }
    );
  }

  try {
    const summary = await processBundle(bundle, store);
    return NextResponse.json({ ok: true, recomputedFrom: bundle.runAt, summary });
  } catch (err) {
    console.error('[recompute] failed:', err);
    return NextResponse.json({ error: 'recompute failed', detail: String(err) }, { status: 500 });
  }
}
