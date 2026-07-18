import type { NightRecommendation, ScoredEvent, Snapshot } from './scoring/types';

/**
 * Sample data shaped exactly like the live Snapshot, used when the store is
 * empty (fresh deploy, local dev) so every page renders through the same code
 * path. Pages show a "sample data" badge whenever this is in play.
 */

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function event(partial: Partial<ScoredEvent> & Pick<ScoredEvent, 'name' | 'date' | 'score' | 'tier' | 'verdict'>): ScoredEvent {
  return {
    id: `demo-${partial.name.toLowerCase().replace(/\W+/g, '-')}`,
    venue: partial.venue ?? 'Nissan Stadium',
    capacity: partial.capacity ?? 69000,
    kind: partial.kind ?? 'concert',
    source: 'demo',
    attendanceEstimate: partial.attendanceEstimate ?? 60000,
    baseDraw: 0.6,
    travelDraw: 0.8,
    dowMultiplier: 1.1,
    isTouring: true,
    ...partial,
  };
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
    reasoning: [`${weekend ? 'Weekend' : 'Weekday'} baseline $${base}`, 'No demand signal for this night'],
    ...overrides,
    tiers: overrides.tiers ?? [
      { tierId: 'standard', label: 'Standard Room', baselineMid: base, recommended: std, range: [std - 5, std + 5] },
      { tierId: 'superior', label: 'Superior Room', baselineMid: base + 15, recommended: std + 15, range: [std + 10, std + 20] },
    ],
  };
}

export function demoSnapshot(): Snapshot {
  const now = new Date();
  const day = (n: number) => new Date(now.getTime() + n * 86400_000);
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

  const nights: NightRecommendation[] = [
    night(day(0), {
      nightScore: 82,
      upliftPct: 12,
      events: [
        event({ name: 'Morgan Wallen @ Nissan Stadium', date: iso(day(0)), score: 82, tier: 'major', verdict: 'Stadium sellout likely — downtown overflow reaches Franklin.' }),
        event({ name: 'Vanderbilt home game', date: iso(day(0)), venue: 'FirstBank Stadium', capacity: 40000, kind: 'sports', score: 11, tier: 'too-small', verdict: 'Too small to matter — shown, not applied.' }),
      ],
      tiers: [
        { tierId: 'standard', label: 'Standard Room', baselineMid: 94, recommended: 89, range: [84, 94] },
        { tierId: 'superior', label: 'Superior Room', baselineMid: 109, recommended: 104, range: [99, 109] },
      ],
      reasoning: [
        'Friday baseline $94',
        'Morgan Wallen @ Nissan Stadium (score 82, major) → +18%',
        'Downtown absorbs most, distance dampener −6%',
        'Compset median $96 supports the range',
        'Vanderbilt home game (score 11) judged too small to matter — shown, not applied',
      ],
    }),
    night(day(1), {
      nightScore: 46,
      upliftPct: 5,
      events: [event({ name: 'Vandy vs. Georgia', date: iso(day(1)), venue: 'FirstBank Stadium', kind: 'sports', score: 46, tier: 'meaningful', verdict: 'Big SEC draw — meaningful overflow expected.' })],
      tiers: [
        { tierId: 'standard', label: 'Standard Room', baselineMid: 94, recommended: 99, range: [94, 104] },
        { tierId: 'superior', label: 'Superior Room', baselineMid: 109, recommended: 114, range: [109, 119] },
      ],
      reasoning: ['Saturday baseline $94', 'Vandy vs. Georgia (score 46, meaningful) → +5%'],
    }),
    night(day(2)),
    night(day(3), {
      nightScore: 55,
      upliftPct: 19,
      holidayName: 'Labor Day',
      tiers: [
        { tierId: 'standard', label: 'Standard Room', baselineMid: 79, recommended: 94, range: [89, 99] },
        { tierId: 'superior', label: 'Superior Room', baselineMid: 94, recommended: 109, range: [104, 114] },
      ],
      reasoning: ['Monday baseline $79', 'Labor Day holiday uplift → +19%'],
    }),
    night(day(4), {
      nightScore: 8,
      events: [event({ name: 'Local 5K run', date: iso(day(4)), venue: 'Harlinsdale Farm', capacity: 2000, kind: 'other', score: 8, tier: 'too-small', verdict: 'Too small to matter — shown, not applied.' })],
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
      { source: 'redroof', status: 'ok', price: 89, room: 'Standard Room', fetchedAt: ago(2) },
      { source: 'expedia', status: 'ok', price: 101, room: 'Standard Room', fetchedAt: ago(14) },
      { source: 'booking', status: 'ok', price: 99, room: 'Standard Room', fetchedAt: ago(22) },
      { source: 'google', status: 'needs-manual-check', error: 'Bot-blocked page — expected behavior for some aggregators.', fetchedAt: ago(240) },
    ],
    compsets: [
      {
        date: iso(day(0)),
        median: 95,
        entries: [
          { name: 'Quality Inn Franklin', price: 79 },
          { name: 'Baymont by Wyndham', price: 84 },
          { name: 'La Quinta Cool Springs', price: 92 },
          { name: 'Comfort Inn', price: 95 },
          { name: 'Holiday Inn Express Berry Farms', price: 109 },
          { name: 'Hampton Inn Franklin', price: 119 },
          { name: 'Aloft Cool Springs', price: 124 },
        ],
      },
      {
        date: iso(day(1)),
        median: 104.5,
        entries: [
          { name: 'Quality Inn Franklin', price: 94 },
          { name: 'Comfort Inn', price: 115 },
        ],
      },
    ],
    sources: [
      { source: 'ticketmaster', status: 'ok', fetchedAt: ago(2) },
      { source: 'cfbd', status: 'ok', fetchedAt: ago(2) },
      { source: 'nws', status: 'ok', fetchedAt: ago(2) },
      { source: 'google-hotels', status: 'failed', error: 'failed to refresh — using 4h old cache', fetchedAt: ago(240) },
    ],
  };
}

export const demoAlerts = [
  {
    id: 'a1', unread: true, tone: 'accent' as const, time: '2h ago',
    title: 'Recommended rate moved $84 → $89 (+$5)',
    desc: 'New event detected: Morgan Wallen 8/14. Compset median is rising.',
  },
  {
    id: 'a2', unread: true, tone: 'bad' as const, time: '4h ago',
    title: 'Parity gap $12: Expedia above direct',
    desc: 'Expedia is charging $101 for the Standard room. Direct rate is $89.',
  },
  {
    id: 'a3', unread: true, tone: 'warn' as const, time: '6h ago',
    title: 'Source broken: MCC calendar parse failed',
    desc: "We couldn't reach the Music City Center calendar. Retrying in 1h.",
  },
  {
    id: 'a4', unread: false, tone: 'neutral' as const, time: 'Yesterday',
    title: 'Big event added: CMA Fest 2027',
    desc: 'Dates confirmed for next year. Added to your long-term radar.',
  },
];

export const demoEventPerformance = [
  { event: 'CMA Fest (Day 1)', date: '6/08', applied: true, adr: 149, uplift: '+45%' },
  { event: 'CMA Fest (Day 2)', date: '6/09', applied: true, adr: 159, uplift: '+55%' },
  { event: 'Local 5K Run', date: '6/15', applied: false, adr: 89, uplift: '0%' },
];

export const demoPortfolio = [
  { name: 'Red Roof Inn', city: 'Franklin, TN', rec: 89, occupancy: '82%', parity: 'gap' as const, alerts: 3 },
  { name: 'Sunrise Suites', city: 'Cookeville, TN', rec: 114, occupancy: '65%', parity: 'ok' as const, alerts: 0 },
  { name: 'The Motel on Main', city: 'Nashville, TN', rec: 189, occupancy: '94%', parity: 'ok' as const, alerts: 1 },
];

export const demoInvoices = [
  { date: 'Jul 1, 2026', amount: '$29.00', status: 'Paid' },
  { date: 'Jun 1, 2026', amount: '$29.00', status: 'Paid' },
];

/** 30-day parity-gap sparkline heights (%), deterministic to avoid hydration mismatch. */
export const demoSparkline = [10, 15, 80, 20, 10, 5, 15, 30, 60, 10, 10, 15, 10, 5, 15, 10, 10, 15, 10, 5, 15, 10, 10, 15, 10, 5, 15, 100, 10, 10];
