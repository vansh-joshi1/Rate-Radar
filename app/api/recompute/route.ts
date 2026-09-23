import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { demoSid, requestPropertyId, requestStore } from '../../../lib/demo/context';
import { recomputeDemoSandbox } from '../../../lib/demo/recompute';
import { processBundle, type Bundle } from '../../../lib/ingest';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { requireRole } from '../../../lib/auth/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Re-run scoring on the LAST collected bundle with the CURRENT store configs
 * (baselines, watchlist). Instant effect for config edits — no scraping, so
 * new watchlist hotels won't gain prices here (that needs a real collection).
 * The snapshot keeps the bundle's original runAt, so data-freshness stays
 * honest; alert rules run too (24h fingerprints prevent duplicate emails).
 * Manager+ — this rewrites the published snapshot and can send alert email.
 */
export async function POST(req: NextRequest) {
  const gate = await requireRole('manager');
  if (!gate.ok) return gate.response;

  const propertyId = new URL(req.url).searchParams.get('propertyId') ?? requestPropertyId();
  if (!getProperty(propertyId)) return NextResponse.json({ error: 'unknown property' }, { status: 404 });

  // A sandbox has no collected bundle — nothing was ever collected for an
  // invented hotel — so it rescores the demo world instead, through the same
  // `recommendNight` that prices the real property. Baseline edits therefore
  // move the numbers in the demo exactly as they do in production.
  if (demoSid()) {
    const snapshot = await recomputeDemoSandbox(requestStore(), propertyId);
    return NextResponse.json({ ok: true, demo: true, recomputedFrom: snapshot.runAt, summary: { nights: snapshot.nights.length } });
  }

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
