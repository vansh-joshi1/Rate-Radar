import type { NightRecommendation, ScoredEvent, Snapshot } from './scoring/types';
import { DEMO_PROPERTY } from './properties';
import { noonUTC, todayIn } from './date';

/**
 * The demo world — sample data shaped exactly like a live Snapshot, used when
 * the store is empty (fresh deploy, local dev) and as the seed for every
 * public demo sandbox. Pages show a "sample data" badge whenever it is in play.
 *
 * EVERYTHING HERE IS INVENTED, deliberately and completely: the property, the
 * town, the competitors, the venues, the acts, the booking channels. Two
 * reasons, and both matter.
 *
 * 1. The real deployment serves one real hotel. Its nightly rates, its comp-set
 *    and its channel parity are that business's private numbers, and the public
 *    demo must not be a window onto them.
 * 2. Attaching invented prices to a real hotel's name, or an invented concert
 *    to a real venue and a real performer, publishes a claim about somebody
 *    that isn't true. A demo doesn't need real names to be convincing, so it
 *    doesn't get to use them.
 *
 * Source labels are generic for the same reason: the live collector really does
 * call Ticketmaster and CFBD, but no such call happened here, so this fixture
 * does not print their names next to a green tick. The architecture is
 * described honestly in the README; the demo describes only itself.
 */

/**
 * Invented hotels near the invented property, used for the watchlist's
 * "add a competitor" autocomplete. In a demo the autocomplete searches this
 * list instead of the live OSM geocoders — partly to keep public demo traffic
 * off two free community services, but mainly because a real geocoder would
 * answer with real hotels and put real businesses back into a fake market.
 */
export const DEMO_NEARBY_HOTELS = [
  { name: 'Gull Point Motor Inn', address: '210 Harbor Rd, Kestrel Bay', lat: 44.6321, lng: -124.0487 },
  { name: 'Tidewater Inn & Suites', address: '48 Tidewater Ln, Kestrel Bay', lat: 44.6244, lng: -124.0601 },
  { name: 'Pinecrest Inn Kestrel Bay', address: '1799 Pinecrest Ave, Kestrel Bay', lat: 44.6402, lng: -124.0435 },
  { name: 'Rivermark Lodge', address: '77 Rivermark Way, Kestrel Bay', lat: 44.6189, lng: -124.0712 },
  { name: 'Lantern Bay Suites', address: '3 Lantern Bay Plaza, Kestrel Bay', lat: 44.6455, lng: -124.0388 },
  { name: 'The Anchorage Hotel', address: '900 Anchorage Dr, Kestrel Bay', lat: 44.6133, lng: -124.0554 },
  { name: 'Cormorant Court Hotel', address: '15 Cormorant Ct, Kestrel Bay', lat: 44.6508, lng: -124.0296 },
  { name: 'Saltgrass Motel', address: '4120 Coast Hwy, Alder Flats', lat: 44.5912, lng: -124.0833 },
  { name: 'Foghorn Bed & Breakfast', address: '62 Foghorn St, Kestrel Bay', lat: 44.6367, lng: -124.0649 },
  { name: 'Wavecrest Extended Stay', address: '505 Wavecrest Blvd, Alder Flats', lat: 44.6021, lng: -124.0918 },
];

/**
 * Where the invented venues stand, so the demo's event map has something to
 * place. Real venues come from VENUE_COORDS in lib/scoring/venues.ts; these
 * never go there, because that table feeds the live distance read and an
 * invented stadium has no business in it.
 *
 * The map under them is real coastline (the demo property's coordinates are a
 * real place), so each venue sits on land, in a spot that fits the fixture's
 * story: downtown (Harborview) is up the coast and its overflow reaches
 * Kestrel Bay, the stadium is inland, the 5K is down the road. The map hides
 * real place names in the demo so none of this is pinned to a real town.
 */
export const DEMO_VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  'harborview amphitheater': { lat: 44.8095, lng: -124.062 },
  'fairmount field': { lat: 44.6215, lng: -123.9385 },
  'mill creek park': { lat: 44.615, lng: -124.03 },
};

export function demoVenueCoords(venue: string): { lat: number; lng: number } | null {
  return DEMO_VENUE_COORDS[venue.trim().toLowerCase()] ?? null;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function event(partial: Partial<ScoredEvent> & Pick<ScoredEvent, 'name' | 'date' | 'score' | 'tier' | 'verdict'>): ScoredEvent {
  return {
    id: `demo-${partial.name.toLowerCase().replace(/\W+/g, '-')}`,
    venue: partial.venue ?? 'Harborview Amphitheater',
    capacity: partial.capacity ?? 22000,
    kind: partial.kind ?? 'concert',
    source: 'demo',
    attendanceEstimate: partial.attendanceEstimate ?? 19000,
    baseDraw: 0.6,
    travelDraw: 0.8,
    dowMultiplier: 1.1,
    isTouring: true,
    ...partial,
  };
}

/**
 * The demo window starts on whatever today is, so the fixture cannot hard-code
 * "Friday baseline $94" — on a Tuesday that prints a reasoning line that
 * contradicts its own date, in a product whose entire claim is that the
 * arithmetic is auditable. Day name and baseline are therefore both derived,
 * and the crafted scenarios below express their prices as multiples of the
 * baseline rather than as fixed dollars.
 */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(d: Date): string {
  return DAY_NAMES[d.getUTCDay()];
}

/** Matches the three day classes in lib/scoring/recommend.ts. */
function baseFor(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 5 || dow === 6 ? 94 : 79;
}

function night(date: Date, overrides: Partial<NightRecommendation> = {}): NightRecommendation {
  const dow = date.getUTCDay();
  const weekend = dow === 5 || dow === 6;
  const base = weekend ? 94 : 79;
  const uplift = overrides.upliftPct ?? 0;
  const std = Math.round(base * (1 + uplift / 100));
  return {
    date: iso(date),
    dow,
    nightScore: 0,
    upliftPct: 0,
    events: [],
    reasoning: [`${dayName(date)} baseline $${base}`, 'No demand signal for this night'],
    ...overrides,
    tiers: overrides.tiers ?? [
      { tierId: 'standard', label: 'Standard Room', baselineMid: base, recommended: std, range: [std - 5, std + 5] },
      { tierId: 'superior', label: 'Superior Room', baselineMid: base + 15, recommended: std + 15, range: [std + 10, std + 20] },
    ],
  };
}

export function demoSnapshot(): Snapshot {
  const now = new Date();
  /* Nights are the property's local nights, the same as a live run. Counting
     from the UTC date put tonight a day ahead every evening on the Pacific
     coast, and the calendar then reported the collector as behind. Noon UTC
     keeps getUTCDay() and the ISO date on the intended day. */
  const tonight = noonUTC(todayIn(DEMO_PROPERTY.timezone, now));
  const day = (n: number) => new Date(tonight.getTime() + n * 86400_000);
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

  const nights: NightRecommendation[] = [
    // Tonight: a major act, one event judged too small to matter, and a
    // compset bound that pulls the number back under its own baseline.
    (() => {
      const d = day(0);
      const base = baseFor(d);
      const std = Math.round(base * 0.95);
      return night(d, {
        nightScore: 82,
        upliftPct: 12,
        events: [
          event({ name: 'Neon Compass @ Harborview Amphitheater', date: iso(d), score: 82, tier: 'major', verdict: 'Sellout likely — downtown fills first, overflow reaches Kestrel Bay.' }),
          event({ name: 'Cascadia State home game', date: iso(d), venue: 'Fairmount Field', capacity: 34000, attendanceEstimate: 4800, kind: 'sports', score: 11, tier: 'too-small', verdict: 'Too small to matter — shown, not applied.' }),
        ],
        tiers: [
          { tierId: 'standard', label: 'Standard Room', baselineMid: base, recommended: std, range: [std - 5, std + 5] },
          { tierId: 'superior', label: 'Superior Room', baselineMid: base + 15, recommended: std + 15, range: [std + 10, std + 20] },
        ],
        reasoning: [
          `${dayName(d)} baseline $${base}`,
          'Neon Compass @ Harborview Amphitheater (score 82, major) → +18%',
          'Downtown absorbs most, distance dampener −6%',
          'Compset median $96 caps the range',
          'Cascadia State home game (score 11) judged too small to matter — shown, not applied',
        ],
      });
    })(),
    (() => {
      const d = day(1);
      const base = baseFor(d);
      const std = Math.round(base * 1.05);
      return night(d, {
        nightScore: 46,
        upliftPct: 5,
        events: [event({ name: 'Cascadia State vs. Ridgeline', date: iso(d), venue: 'Fairmount Field', capacity: 34000, attendanceEstimate: 26500, kind: 'sports', score: 46, tier: 'meaningful', verdict: 'Rivalry weekend — meaningful overflow expected.' })],
        tiers: [
          { tierId: 'standard', label: 'Standard Room', baselineMid: base, recommended: std, range: [std - 5, std + 5] },
          { tierId: 'superior', label: 'Superior Room', baselineMid: base + 15, recommended: std + 15, range: [std + 10, std + 20] },
        ],
        reasoning: [`${dayName(d)} baseline $${base}`, 'Cascadia State vs. Ridgeline (score 46, meaningful) → +5%'],
      });
    })(),
    night(day(2)),
    (() => {
      const d = day(3);
      const base = baseFor(d);
      const std = Math.round(base * 1.19);
      return night(d, {
        nightScore: 55,
        upliftPct: 19,
        holidayName: 'Harbor Days',
        tiers: [
          { tierId: 'standard', label: 'Standard Room', baselineMid: base, recommended: std, range: [std - 5, std + 5] },
          { tierId: 'superior', label: 'Superior Room', baselineMid: base + 15, recommended: std + 15, range: [std + 10, std + 20] },
        ],
        reasoning: [`${dayName(d)} baseline $${base}`, 'Harbor Days holiday uplift → +19%'],
      });
    })(),
    night(day(4), {
      nightScore: 8,
      events: [event({ name: 'Harbor Run 5K', date: iso(day(4)), venue: 'Mill Creek Park', capacity: 2000, attendanceEstimate: 1400, kind: 'other', score: 8, tier: 'too-small', verdict: 'Too small to matter — shown, not applied.' })],
    }),
    ...Array.from({ length: 16 }, (_, i) => night(day(5 + i))),
  ];

  return {
    runAt: now.toISOString(),
    runId: 'demo',
    confidence: 78,
    confidenceNote: '3 of 4 rate sources fresh, event data 2h old',
    nights,
    parity: [
      {
        source: 'Harbor Pine Inn — direct', official: true, status: 'ok', price: 89,
        room: 'cheapest room, public flexible rate (member rates excluded)',
        rooms: [
          { room: 'Deluxe 2 Queen Beds Non-Smoking', price: 89, memberPrice: 80, tierId: 'standard' },
          { room: 'Deluxe King Non-Smoking', price: 89, memberPrice: 80, tierId: 'standard' },
          { room: 'Superior King Non-Smoking', price: 104, memberPrice: 94, tierId: 'superior' },
          { room: 'Superior 2 Queen Beds Non-Smoking', price: 104, memberPrice: 94, tierId: 'superior' },
        ],
        fetchedAt: ago(2),
      },
      { source: 'Expedia.com', status: 'ok', price: 101, fetchedAt: ago(2) },
      { source: 'Booking.com', status: 'ok', price: 99, fetchedAt: ago(2) },
      { source: 'Hotels.com', status: 'ok', price: 101, fetchedAt: ago(2) },
      { source: 'Priceline', status: 'ok', price: 99, fetchedAt: ago(2) },
      { source: 'Agoda', status: 'ok', price: 101, fetchedAt: ago(2) },
      { source: 'Trip.com', status: 'ok', price: 101, fetchedAt: ago(2) },
      // A reseller undercutting direct by $13. Kept in the sample because the
      // collector really does return rows like this — but it is NOT reported
      // anywhere now: the channel policy (lib/parity/channels.ts) narrows
      // parity to direct + Booking + Expedia, so the demo reads as in-parity.
      { source: 'Super.com', status: 'ok', price: 76, fetchedAt: ago(2) },
      { source: 'Traveluro', status: 'ok', price: 84, fetchedAt: ago(2) },
    ],
    compsets: [
      {
        date: iso(day(0)),
        median: 95,
        entries: [
          { name: 'Gull Point Motor Inn', price: 79 },
          { name: 'Tidewater Inn & Suites', price: 84 },
          { name: 'Pinecrest Inn Kestrel Bay', price: 92 },
          { name: 'Rivermark Lodge', price: 95 },
          { name: 'Lantern Bay Suites', price: 109 },
          { name: 'The Anchorage Hotel', price: 119 },
          { name: 'Cormorant Court Hotel', price: 124 },
        ],
      },
      {
        date: iso(day(1)),
        median: 104.5,
        entries: [
          { name: 'Gull Point Motor Inn', price: 94 },
          { name: 'Rivermark Lodge', price: 115 },
        ],
      },
    ],
    sources: [
      { source: 'events-api', status: 'ok', fetchedAt: ago(2) },
      { source: 'college-sports', status: 'ok', fetchedAt: ago(2) },
      { source: 'weather-alerts', status: 'ok', fetchedAt: ago(2) },
      { source: 'hotel-prices', status: 'failed', error: 'failed to refresh — using 4h old cache', fetchedAt: ago(240) },
    ],
  };
}

export const demoAlerts = [
  {
    id: 'a1', unread: true, tone: 'accent' as const, time: '2h ago',
    title: 'Recommended rate moved $84 → $89 (+$5)',
    desc: 'New event detected: Neon Compass at Harborview. Compset median is rising.',
  },
  {
    id: 'a2', unread: true, tone: 'bad' as const, time: '4h ago',
    title: 'Parity gap $12: Expedia above direct',
    desc: 'Expedia.com is charging $101 for the Standard room. Direct rate is $89.',
  },
  {
    id: 'a3', unread: true, tone: 'warn' as const, time: '6h ago',
    title: 'Source broken: convention calendar parse failed',
    desc: "We couldn't reach the convention centre calendar. Retrying in 1h.",
  },
  {
    id: 'a4', unread: false, tone: 'neutral' as const, time: 'Yesterday',
    title: 'Big event added: Harbor Days Festival 2027',
    desc: 'Dates confirmed for next year. Added to your long-term radar.',
  },
];

export const demoPortfolio = [
  { name: 'Harbor Pine Inn', city: 'Kestrel Bay, OR', rec: 89, occupancy: '82%', parity: 'gap' as const, alerts: 3 },
  { name: 'Sunrise Suites', city: 'Alder Flats, OR', rec: 114, occupancy: '65%', parity: 'ok' as const, alerts: 0 },
  { name: 'The Motel on Main', city: 'Ferrymead, WA', rec: 189, occupancy: '94%', parity: 'ok' as const, alerts: 1 },
];

export const demoInvoices = [
  { date: 'Jul 1, 2026', amount: '$99.00', status: 'Paid' },
  { date: 'Jun 1, 2026', amount: '$99.00', status: 'Paid' },
];
