import { NextResponse } from 'next/server';
import { getStore } from '../../../../../backend/lib/store';
import { PROPERTIES_KEY, type Property } from '../../../../../backend/lib/properties';
import { isCollector } from '../../../../../backend/lib/api/property-request';

export const dynamic = 'force-dynamic';

/**
 * GET — the hotels approved from onboarding, for the collector (INGEST_SECRET).
 * The original property is not listed: the collector has it in config.
 */
export async function GET(req: Request) {
  if (!isCollector(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const properties = (await getStore().get<Property[]>(PROPERTIES_KEY)) ?? [];
  return NextResponse.json({ properties });
}
