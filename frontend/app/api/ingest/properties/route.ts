import { NextResponse } from 'next/server';
import { getStore } from '../../../../../backend/lib/store';
import { PROPERTIES_KEY, type Property } from '../../../../../backend/lib/properties';
import { isCollector } from '../../../../../backend/lib/api/property-request';
import { access, accountFor } from '../../../../../backend/lib/billing/accounts';

export const dynamic = 'force-dynamic';

/**
 * GET — the hotels approved from onboarding, for the collector (INGEST_SECRET).
 * The original property is not listed: the collector has it in config.
 * Hotels whose trial or subscription has lapsed are left out.
 */
export async function GET(req: Request) {
  if (!isCollector(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = getStore();
  const all = (await store.get<Property[]>(PROPERTIES_KEY)) ?? [];
  // A locked hotel spends no searches; its data is kept and collection resumes once it subscribes.
  const now = new Date();
  const open = await Promise.all(all.map(async (p) => access(await accountFor(store, p.id, now), p.id, now) === 'open'));
  return NextResponse.json({ properties: all.filter((_, i) => open[i]) });
}
