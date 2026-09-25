import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSerpApiClient, type SerpProperty, type SerpPropertyDetails } from '../../../../../backend/collector/sources/serpapi';
import { getStore } from '../../../../../backend/lib/store';
import { addDays, todayIn } from '../../../../../backend/lib/date';
import { allCandidates, channelsOf, rankCandidates, roomsOf } from '../../../../../backend/lib/onboarding';

export const dynamic = 'force-dynamic';

/**
 * Onboarding discovery. Public (the /onboarding walkthrough has no session)
 * and read-only: it stores nothing but a counter.
 *
 *   search:  by name, and "hotels near <address>" -> "Is this you?"
 *            candidates, every nearby hotel (kept by the client for comp set
 *            suggestions), and the match's channels and rooms when Google
 *            answers the name with that hotel's own page.
 *   details: one property_token      -> the channels selling it and its rooms.
 *
 * Every call is one metered SerpApi search, drawn from the same 250/month,
 * no-overage plan the collector runs on (collector/budget.ts). A hard daily
 * cap keeps sign-ups from starving collection. Past the cap, or on any SerpApi
 * failure, the client falls back to manual entry.
 *
 * ponytail: one global cap, so one visitor can use a day's allowance and
 * everyone else types by hand. Add a per-IP limit if sign-up traffic is real.
 */

const DAILY_SEARCH_CAP = 6;
const TZ = 'America/Chicago';

const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('search'), name: z.string().trim().min(2).max(120), address: z.string().trim().min(5).max(200) }),
  z.object({
    kind: z.literal('details'),
    token: z.string().min(4).max(200),
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(5).max(200),
  }),
]);

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const today = todayIn(TZ);
  const store = getStore();
  // One unit per metered search, checked before it is spent.
  const take = async () => (await store.incr(`onboarding:serp:${today}`, 60 * 60 * 26)) <= DAILY_SEARCH_CAP;

  const client = createSerpApiClient(apiKey);
  const checkIn = addDays(today, 1);
  const checkOut = addDays(today, 2);
  const body = parsed.data;

  try {
    if (body.kind === 'search') {
      if (!(await take())) return NextResponse.json({ error: 'cap' }, { status: 429 });
      // By name finds the hotel itself; "hotels near" alone often left it out
      // of the ~20 results and offered only lookalikes. The nearby search
      // feeds the comp set, and is skipped rather than refused at the cap.
      const [byName, near] = await Promise.all([
        client.searchProperties(`${body.name}, ${body.address}`, checkIn, checkOut),
        take().then((ok) => (ok ? client.searchProperties(`hotels near ${body.address}`, checkIn, checkOut) : [])),
      ]);
      const candidates = rankCandidates(body.name, body.address, [...byName, ...near]);
      // A name query Google resolves to one hotel returns that hotel's own
      // page, details included: confirming it then needs no third search.
      const page = byName.length === 1 ? (byName[0] as SerpProperty & SerpPropertyDetails) : null;
      const prefetched =
        page?.property_token && candidates.some((c) => c.token === page.property_token)
          ? { token: page.property_token, channels: channelsOf(page), rooms: roomsOf(page) }
          : null;
      return NextResponse.json({ candidates, hotels: allCandidates([...near, ...byName]), prefetched });
    }
    if (!(await take())) return NextResponse.json({ error: 'cap' }, { status: 429 });
    const details = await client.propertyDetails(body.token, `${body.name} ${body.address}`, checkIn, checkOut);
    return NextResponse.json({ channels: channelsOf(details), rooms: roomsOf(details) });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
