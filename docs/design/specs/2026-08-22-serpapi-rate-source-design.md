# SerpApi as the Rate Source

**Status:** approved design, not yet implemented
**Date:** 2026-08-22
**Supersedes:** `2026-08-16-compset-transport-hardening-design.md` (never implemented)
**Touches:** `collector/sources/rates.ts`, `collector/budget.ts` (new),
`collector/sources/serpapi.ts` (new), `config/properties.json`,
`.github/workflows/collect.yml`, `app/api/cron/heartbeat/route.ts`,
`app/api/collect-now/route.ts`, `lib/ingest.ts`, `lib/scoring/types.ts`,
`components/ParityGrid.tsx`, `components/SettingsView.tsx`

## Why

The Phase-1 design was built on one constraint: **no third-party price API**, because a
vendor can shut down, reprice, or revoke access. Everything followed from it —
Patchright, a self-hosted runner on the owner's laptop, a persistent browser profile,
and a telemetry phase whose entire purpose was to measure how much of the failure was
bot-blocking.

That constraint is withdrawn. The deciding fact: **the collector can no longer scrape
even our own site.** When the direct check against redroof.com fails, the argument for
self-hosting collapses — we are not defending a working pipeline from a vendor, we are
maintaining an evasion arms race to reach a page we are entitled to read, and losing it.

Nothing from Phase 1 shipped, so the switch discards no built work.

The replacement is smaller than what it replaces. Two SerpApi calls cover everything the
588 lines of browser driving currently attempt, plus several things they never managed:
dates the source actually honours, per-OTA parity beyond four hard-coded sources, and a
real distinction between "sold out" and "we failed."

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Data source | SerpApi, `google_hotels` engine | Free tier is 250 searches/month **recurring**, and one search returns every nearby property priced for a date |
| Plan | Free (250/mo, 50/hr) | Runs at $0 indefinitely; pre-revenue, one property |
| Vendor lock-in | Accepted, with a named exit | Everything downstream consumes `RateCheck[]` / `CompsetEntry[]`, so a vendor swap is one file |
| Later vendor | StayAPI, when revenue makes $49/mo trivial | `/v1/price-compare` is the parity feature as one endpoint, and brand-direct coverage (Wyndham, Choice, IHG) is Phase 2's adapter list off the shelf |
| Provider abstraction | **Not built** | The existing types already are the abstraction. An interface designed against one real implementation and one imagined one fits the imagined one badly |
| Browser | Removed entirely | `playwright` leaves `devDependencies`; run time drops from ~10 min to seconds |
| Spending model | Budget-aware scheduler reading live quota | The cap is hard and unforgiving; degrading beats erroring |
| Scheduler state | **None** — pure function of clock and live quota | Run position derives from a fixed schedule, so no store round-trip and full unit-testability |
| Cadence | 3 runs/day CT — 07:00, 13:00, 18:00 (down from 7) | ~217 searches/month at the full ladder, leaving ~33 unspent, of which 20 is the held-back reserve |
| Competitor matching | `property_token`, resolved once and persisted | Exact, replacing fuzzy name substrings against two differently-phrased sites |
| Telemetry | Budget panel replaces the blocking panel | There is nothing left to evade; what can now go wrong is running out of searches |

### Rejected alternatives

**StayAPI now.** The better product for this job on every axis except the one that
decides it: its free tier is 50 requests once, not a recurring allowance, and paid starts
at $49/month on a quote-based, per-property model. Revisit when customers exist — this
design keeps that door one file wide.

**Prototyping both against the real compset first.** Genuinely informative, since these
ten competitors are small independents whose API coverage varies. Rejected as a phase:
rollout step 1 answers the coverage question for SerpApi for about two searches, and if
the answer is bad, that finding arrives before any code is written anyway.

**Fixed three-tier schedule with no live quota read** (morning spends 5, midday and
evening spend 1). Simpler, no new state, ~217/month. Rejected because it is blind: about
six manual runs would exhaust the reserve, and collection would then die silently for the
remainder of the month.

**One deep run per day** (8 searches, full coverage, 240/month). Simplest of all and the
best single-day depth. Rejected because data would be up to 24h old and alerts would drop
to once daily — for a product whose purpose is "email when something merits attention,"
that is a product regression, not a cost saving.

**Keeping the redroof.com scrape for per-room tier rates.** The original reason to keep a
browser. Unnecessary: `featured_prices[].rooms[]` carries room name and nightly rate, and
`prices[].official` identifies our own listing. `mapRoomToTier` works on it unchanged.

*Implementation correction:* the two live in different arrays. `official: true` is in
`prices[]`; the `rooms[]` breakdown is in `featured_prices[]` and comes from OTA listings
(Expedia, Hotels.com), not from our own booking engine — the official listing reports one
nightly rate and no breakdown. Tier rates are therefore "as listed on OTAs," which is
enough to separate Standard from Superior but is not our direct rate card.

## Scope

**In:** the SerpApi client; the budget scheduler; response-to-domain mapping; removal of
the entire browser stack; `property_token` replacing `bookingUrl` on the watchlist;
schedule reduction to 3/day and the freshness thresholds that depend on it; a
quota-exhaustion alert; a budget panel in Settings.

**Out:** any provider abstraction layer; StayAPI; date coverage beyond tomorrow plus
event nights; geographic (radius-based) compset selection in place of the curated
watchlist; changes to scoring, recommendation, or alert rules.

## Design

### 1. File layout

`collector/sources/rates.ts` — 588 lines of browser driving — becomes three files:

| File | Purpose | Knows SerpApi exists |
|---|---|---|
| `collector/sources/serpapi.ts` | HTTP client: `searchProperties()`, `propertyDetails()`, `accountQuota()` | **Yes — only file that does** |
| `collector/sources/rates.ts` | Executes the plan, maps responses to domain types | No |
| `collector/budget.ts` | Pure `planSearches()`, no I/O | No |

`SourceResult { source: 'rates', data: { checks, compsets } }` is unchanged. Ingest,
scoring, alerts and every dashboard component are untouched by the vendor change — the
same property that makes a later StayAPI swap a one-file job.

### 2. The budget scheduler

```ts
interface SearchPlan {
  tier: 'full' | 'reduced' | 'minimal';
  compsetDates: string[];                          // ordered, tomorrow always first
  propertyDetails: boolean;                        // parity + room tiers
  skipped: { date: string; reason: 'budget' }[];
}

planSearches(input: {
  remaining: number;                               // live from SerpApi /account
  now: Date;
  dates: string[];                                 // tomorrow + event nights
}): SearchPlan
```

The plan is a **fixed ladder per run slot**, gated by a **degradation tier** derived from
the live quota. Nothing is divided at runtime, so the daily spend is exactly predictable.

The ladder, by slot (slot index derives from the clock against the fixed
07:00 / 13:00 / 18:00 CT schedule — no stored state, which is what keeps the function
pure):

| Slot | `full` | `reduced` | `minimal` |
|---|---|---|---|
| 07:00 | tomorrow compset + property details + up to 3 event nights (**5**) | tomorrow compset + property details (**2**) | tomorrow compset (**1**) |
| 13:00 | tomorrow compset (**1**) | tomorrow compset (**1**) | — |
| 18:00 | tomorrow compset (**1**) | tomorrow compset (**1**) | — |
| **Per day** | **7** | **4** | **1** |

The tier, with `RESERVE = 20` and `budget = remaining - RESERVE`:

```
budget >= daysLeftInMonth * 7   → 'full'      (7/day)
budget >= daysLeftInMonth * 4   → 'reduced'   (4/day)
otherwise                       → 'minimal'   (1/day)
```

Steady state is `full`: 7/day, ~217/month against a 230 spendable budget, with the
20-search reserve untouched for manual runs.

The tier is recomputed every run, so degradation and recovery are both automatic. A month
that overspends early drops to `reduced` or `minimal`, and climbs back as `daysLeft`
shrinks faster than `remaining` does — worked example: on day 20 with 55 left and 11 days
to go, `budget = 35 < 44`, so `minimal`; by day 25 with 50 left and 6 days to go,
`budget = 30 >= 24`, so `reduced`. Tomorrow's compset is never dropped at any tier.

**On the reset date.** SerpApi resets on the account anniversary, not the 1st. This spec
originally accepted calendar month-end as a self-correcting approximation — **implementation
found that `/account` returns `plan_renewal_date` directly**, so days-left is computed
exactly and the approximation survives only as the fallback for an unreachable `/account`.
The approximation was worse than "conservative for a few days" as originally claimed: on
the 30th with a renewal three weeks out, month-end says one day is left and the ladder
would spend the remaining quota in four days.

**Manual runs are bounded, not free.** `/api/collect-now` triggers a run that computes the
same plan against the same live quota, so it spends the current tier's 07:00-slot ladder —
five searches at `full`, one at `minimal`. Two things bound the damage: a **15-minute
throttle** on the endpoint, and the tier gate itself, which drops to `reduced` and then
`minimal` as the manual runs eat the budget. Worst case is roughly 20 searches an hour of
sustained clicking, self-limiting downward; it is not possible to exhaust a month in a
sitting.

### 3. Data flow, one run

```
accountQuota()  ──► remaining              (free — not counted against quota)
planSearches()  ──► plan                   (pure)
   │
   ├─ searchProperties(q, tomorrow)     ─► properties[]
   │     ├─ match vs watchlist tokens ──► CompsetEntry[]
   │     └─ our own hotel is in here ───► free cross-check on our listed rate
   │
   ├─ propertyDetails(token, tomorrow)
   │     ├─ prices[].official: true ────► RateCheck "Direct (your site)"
   │     ├─ prices[] (~25 channels) ────► RateCheck per channel
   │     └─ featured_prices[].rooms[] ──► RoomRate[] (standard / superior)
   │
   └─ searchProperties(q, eventNight)   ─► CompsetEntry[] per date
```

Two long-standing problems dissolve rather than get fixed. The honesty guard at
`rates.ts:564` exists because Google served default-date carousels under suspicion;
SerpApi honours `check_in_date`, so the guard is deleted rather than ported. And "sold
out" becomes distinguishable from "we failed" — a property present in `properties[]` with
no `rate_per_night` is genuinely unavailable, which the scraper could never tell us.

### 4. Deletions

From `rates.ts`: `newPage`, `settlePage`, `extractPrice`, `botWalled`, `makeChecker`,
`buildCheckers`, `resolveBookingUrl`, `competitorDirectChecks`, `compsetForDate`,
`harvestCompset`, `parseRedroofRooms`, `parseRedroofPublicPrices`, `bookingUrlWithDates`,
`bookingSlugMatchesName`, `rewriteDates`, `MAX_RESOLVES_PER_RUN`, the `compsetHarvest`
module-level mutable, and the honesty guard.

From the project: `playwright` in `devDependencies`, and the
`npx playwright install --with-deps chromium` workflow step.

`mapRoomToTier` and each property's `roomTierMap` survive unchanged — they now map
`featured_prices[].rooms[].name` instead of scraped HTML.

### 5. Config and secrets

Retired: `RATE_URL_REDROOF`, `RATE_URL_EXPEDIA`, `RATE_URL_BOOKING`,
`GOOGLE_HOTELS_QUERY`. Added: `SERPAPI_KEY` (a GitHub Actions secret; the key stays in the
collector and never reaches Vercel).

`config/properties.json` gains a per-property `serpapi: { query, propertyToken }` block,
and its `_comment` — currently asserting "our own scraping pipeline, no third-party data
APIs" — is rewritten to state the opposite.

### 6. Watchlist: `bookingUrl` becomes `propertyToken`

Existing machinery repurposed, not added to. The collector resolves each watchlist name to
a stable `property_token` from the compset results and returns it; ingest persists it
exactly where it persists `bookingUrl` today (`lib/ingest.ts:125`). After the first run,
matching is by token — exact rather than fuzzy.

This retires a real UX wart. `WatchlistManager.tsx:132` and `CompetitorInsights.tsx:744`
both instruct the owner to keep hotel names short "because they're matched against
booking-site results." That stops being true, and the guidance is removed.

`bookingUrl` is dropped from writes and ignored on read. No store migration: existing
records carry a dead field until they age out.

### 7. Parity surface

`RateCheck.source` widens from the union `'redroof' | 'google' | 'expedia' | 'booking'` to
`string`, because `featured_prices[]` surfaces whatever channels Google lists —
Hotels.com, Priceline and others. `ParityGrid.tsx:10` labels the `official` entry "Direct
(your site)" and passes other source names through verbatim. The result is more parity
channels than today, not fewer, and no hard-coded list to maintain.

### 8. Scheduling knock-ons

| Where | Now | Becomes | Why |
|---|---|---|---|
| `collect.yml` crons | 7×/day CT | 07:00 / 13:00 / 18:00 CT | budget |
| `collect.yml` freshness gate | `ageHours < 1.25` | `< 4` | otherwise every enumerated cron candidate hour collects |
| `heartbeat` `STALE_HOURS` | 4 | 14 | covers the 18:00→07:00 overnight gap; at 4 it fires a rescue dispatch nightly and burns searches |
| `collect.yml` timeout | 15 min | 5 min | no browser |

`/api/health`'s own 24h `ok` flag and the `health.yml` watchdog are unaffected.

### 9. Error handling

SerpApi returns an `error` key in the JSON body with HTTP 200, so success is "no `error`
key," not `res.ok`. Three outcomes are kept distinct:

- **Quota exhausted** — `SourceResult.status: 'failed'` with an explicit message, plus a
  one-shot alert email when `total_searches_left < 10`. This is the new silent-death mode
  and it earns the same alerting total scraper failure had.
- **Property absent from `properties[]`** — recorded per hotel as `not-found`, not an
  error. It means the competitor is not in Google Hotels at all, which is a fact about the
  watchlist, not a fault.
- **Property present with no `rate_per_night`** — sold out. Shown as such.

### 10. Settings panel

Phase 1's blocking telemetry is obsolete. In its place, a smaller budget panel in the same
section: searches remaining, month-to-date usage, the **current tier** and what tips it
into the next one down, today's plan, and what the scheduler skipped for budget. Read-only;
any role that can see Settings can see it.

The tier is the number that matters operationally — "we are in `reduced`, event nights are
not being priced" is the one condition an owner would want to notice and act on, by pausing
manual runs or upgrading the plan.

## Rollout

No baseline period. That requirement was specific to answering "did transport hardening
help?", and there is no longer a transport to measure.

1. **Coverage check, before any mapping code.** Sign up, set `SERPAPI_KEY`, run one live
   `google_hotels` search for Franklin and read the property list. (~2 searches)
2. **Capture fixtures, build, test offline.** (0 searches)
3. **Deploy; one manual run; verify the dashboard.** (~5 searches)
4. **Enable the 3/day schedule.**

Step 1 is a gate, not a formality. If Google Hotels carries only six of the ten watchlist
hotels, that changes the watchlist conversation before any code exists.

## Testing

The project's boundary holds — pure logic tested, fetching not — and improves, because the
inputs become stable captured JSON instead of live HTML.

- **New, fixture-driven:** `planSearches` (tier thresholds at their exact boundaries, the
  ladder each slot produces per tier, tomorrow's compset never dropped, recovery from
  `minimal` as `daysLeft` shrinks, month rollover); `toCompsetEntries` (token and name matching,
  `priceSanity` bounds); `toParityChecks` (`official` → Direct); `toRoomRates`
  (`roomTierMap` application).
- **Fixtures:** real SerpApi responses captured once during rollout step 1, in
  `tests/fixtures/`.
- **Retired:** `harvest.test.ts`, `compset-direct.test.ts`, `redroof-public-rate.test.ts`,
  and the scraper half of `parsers.test.ts`.
- **Unaffected:** `role-guard.test.ts` — no new mutating route; the write path is still
  `/api/ingest`.
- **Manual, step 3:** one `workflow_dispatch`, confirming the plan is computed, searches
  are spent as predicted, and the budget panel reports the drop.

## Risks

**Coverage of small independents.** ~~The genuine unknown.~~ **Answered 2026-08-23: 8 of
10.** Super 8 and Motel 6 are absent from both results pages. Page 2 was checked and is
worse data, not more — it drifts to Antioch and Brentwood and re-lists page-1 hotels at
different, higher rates, so one search per date stands. The two missing hotels surface as
`not-found` in the budget panel; either drop them from the watchlist or accept the gap.

**250 searches/month is tight.** A heavy manual-run month degrades coverage to
tomorrow-only. The reserve bounds it and the panel makes it visible rather than
surprising — but the honest ceiling is roughly 7 searches a day.

**Control traded for reliability — the deal this design accepts.** If Google changes
something, we wait for SerpApi to fix it; there is no self-hosted workaround left. The free
tier carries no SLA and no legal shield (that begins at $150/month). This directly reverses
the constraint Phase 1 was built on, and it should be re-examined, not forgotten, if
SerpApi ever fails us the way the scraper did.

**Google's prices are Google's view of OTA prices** and can lag the source by hours. Parity
findings are "as Google sees it." Honest, and still far better than the current state,
which is no data at all.

## What survives from Phase 2

`MAX_RESOLVES_PER_RUN` and the tomorrow-only date limit are solved here rather than
deferred. The `extractPrice` whole-body scan is deleted along with the scraper. What
remains is brand-direct coverage (Choice, IHG, Wyndham, G6, Hilton) — and that is now an
argument for moving to StayAPI, whose brand-direct endpoints supply it, rather than a set
of adapters to write.

---

## Amendment, 2026-08-23: the horizon starts tonight

Shipped as designed, then a question exposed a gap the design had inherited
without examining: **the collector only ever priced tomorrow.**

The engine scores `today + 21` and the Overview's headline recommendation is
`nights[0]` — tonight. Compset is applied per night by date lookup, so tonight,
the most-read number on the site, was the one night with no competitor bound
under it. `HistoryRecord.compsetMedian` read `compsetByDate.get(today)`, which
was therefore **structurally always null**: the market-median trend line could
never plot a point. Both predate SerpApi; the scraper priced tomorrow too.

### What changed

`tomorrow + up to 3 event nights` becomes a **rolling 5-night horizon starting
today**, and the schedule drops to 2 runs/day.

| Slot | Full tier | Cost |
|---|---|---|
| 07:00 | five nights of compset + our parity/room rates | 6 |
| 13:00 | tonight again | 1 |

Still 7/day, ~217/month. `reduced` cuts the horizon to tonight and tomorrow
(4/day); `minimal` is tonight alone (1/day).

### Event nights are retired, not sacrificed

`pickCompsetDates` selected nights scoring **≥ 40**. `applyCompsetBound` never
caps a night scoring **≥ 40**. Every event-night search ever made therefore
produced an informational note and never once moved a recommended price. They
were pure cost. `collector/eventNights.ts` and its test are deleted.

The horizon covers those nights properly for anything within five days, and
unlike the old fetch it does affect the recommendation. Beyond five days there
is now no compset — which costs nothing, for the same reason.

### Sold out versus not carried

The first live run over the new horizon reported Quality Inn as `not-found`
for tonight, having priced it that morning. Sold-out properties sometimes drop
out of Google Hotels results entirely rather than listing without a rate, so
the original split mislabelled them.

A resolved `property_token` is proof Google carries the hotel. Absence despite
a known token is now reported as `unavailable` (sold out); absence with no
token ever resolved stays `not-found` (genuinely not carried, as with Super 8
and Motel 6).

### A full week

Considered and rejected on cost, not merit. Seven nights refreshed against a
250/month allowance leaves no room for intraday refresh or manual runs — it
fits only by consuming the reserve, which is the shape most likely to stop
collecting silently mid-month. A week needs SerpApi Starter ($25/month, 1,000
searches), which would also allow 3 runs/day and leave the budget tiers
dormant at ~37% utilisation. Revisit with revenue, alongside the StayAPI swap.

### Knock-ons

`RUN_SLOTS_CT` is `[7, 13]`; the collect crons match. The freshness gate moves
1.25h → 5h (the 07:00→13:00 gap is 6h). The heartbeat's `STALE_HOURS` moves to
20, above the 18h overnight gap.
