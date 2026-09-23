# Consolidation refactor — design

**Date:** 2026-09-22
**Status:** approved
**Scope:** behaviour-preserving. No feature changes, no API changes, no rendered
output changes.

## Why

A review of the whole tree found four kinds of duplication, one block of dead
code, and a test runner sweeping in a stale copy of its own suite. None of it is
broken today; all of it is drift that has already produced one latent defect
(two incompatible `Icon` variants, only one of which has CSS behind it).

The goal is one consolidation pass followed by rigorous verification — not a
restructuring. Where a change would move a pixel or alter a response shape, it
is out of scope and named as such below.

## Findings this addresses

| Finding | Evidence |
|---|---|
| ~650 lines of unreferenced components | `CompsetExplorer.tsx`, `WatchlistManager.tsx`, `CompsetMap.tsx` have no importers; their watchlist CRUD lives on in `CompetitorInsights.tsx` |
| `new Date(\`${d}T12:00:00Z\`)` hand-rolled in ~14 places | `ingest.ts`, `budget.ts`, `rates.ts`, `recommend.ts`, `score.ts`, `rules.ts`, 6 components, 1 page |
| `addDays` defined twice, `dayOfWeek` defined twice | `ingest.ts:79` / `rates.ts:22`; `recommend.ts:22` / `score.ts:17` |
| `todayIn` exists but is re-inlined | `lib/tz.ts` vs `rates.ts:196`, `cfbd.ts:25` |
| `Icon` defined 5×, in 2 incompatible variants | `data-weight="fill"` (3 files) vs `className="fill"` (2 files); only the former has a CSS rule (`globals.css:113`) |
| Route boilerplate | `propertyIdFrom` ×3 + 2 inline variants; `getProperty → 404` ×8 across 5 route files |
| Storage key built outside `propKey` | `` `prop:${id}:bundle:latest` `` inline in `ingest.ts:242` and `recompute/route.ts:29` |
| Vitest runs a stale duplicate suite | No `vitest.config.ts`, so `.claude/worktrees/accounts-and-onboarding/tests/**` is swept in — 39 files run where 17 exist |

## Architecture

Five shared modules absorb the duplication; every other change is a mechanical
call-site update.

### A. `lib/date.ts` — one calendar-date module

Absorbs `lib/tz.ts`, which is deleted (2 importers). Inherits its constraint:
**zero imports**, so client components can use it without pulling in the store
and the scoring stack.

| Export | Replaces |
|---|---|
| `todayIn(timeZone, now?)` | moved verbatim from `lib/tz.ts`; also the inline `en-CA` calls in `rates.ts:196`, `cfbd.ts:25` |
| `noonUTC(date)` | the `` new Date(`${d}T12:00:00Z`) `` idiom |
| `addDays(date, n)` | `ingest.ts:79`, `rates.ts:22` |
| `dayOfWeek(date)` | `recommend.ts:22`, `score.ts:17`, inline at `ingest.ts:175` |
| `dateRange(from, count)` | the window builder in `ingest.ts`, `horizonDates` in `budget.ts:61` |
| `fmtDay`, `fmtDow`, `fmtWeekdayLong`, `fmtMonthYear`, `fmtRange` | the scattered `toLocaleDateString` option objects |

**Formatters preserve their exact original option objects, per call site.**
Where two sites format differently, they get two exports. Output is not
normalised — normalising it would be a rendered-text change, which this refactor
does not make.

`rules.ts` is the sharp edge: `rules.test.ts` asserts exact strings
(`'Wed, Sep 30: recommended $65 (was $72).'`), which is the guardrail for the
whole formatter move.

`horizonDates` stays exported from `budget.ts` — `budget.test.ts` imports it —
and becomes a one-line call into `dateRange`.

### B. `components/Icon.tsx`

One `Icon`, the `data-weight="fill"` variant. Replaces 5 local copies in
`CompetitorInsights`, `MarketIntelligence`, `SettingsView`, `shell/AppShell`,
`overview/page`.

Zero rendered difference: neither of the two files carrying the broken
`className="fill"` variant ever passes `fill={true}`, so that code path was
never exercised. Unifying repairs a latent defect without moving a pixel.

### C. `lib/api/property-request.ts`

`propertyFromRequest(req)` → `{ propertyId, property } | NextResponse`,
returning the identical `{ error: 'unknown property' }` / 404 the routes return
today. Replaces `propertyIdFrom` ×3 and the guard ×8 across `watchlist`,
`current-rates`, `rates-config`, `recompute`, `hotel-search`.

Deliberately **not** folded into `lib/api/context.ts`: that module serves the v1
public API and speaks a different error envelope (`{error:{code,message}}` via
`apiError`). Merging them would change response shapes on one side.

### D. `propKey.bundleLatest(id)`

Added to `lib/properties.ts`; the two inline builds call it. **Same key string**
— a rename would orphan live store data.

### E. Deletions

`components/CompsetExplorer.tsx`, `components/WatchlistManager.tsx`,
`components/CompsetMap.tsx`.

Retained: `lib/geo.ts` (`haversineMiles` still used by `hotel-search`),
`leaflet` + `@types/leaflet` (still used by `EventsMap`).

### F. `vitest.config.ts`

New file. Excludes `.claude/**` alongside vitest's defaults (`node_modules`,
`dist`, `.next`), so the suite stops running a stale copy of itself. Real
coverage is unchanged; the reported test count drops because the phantom half
disappears.

## Out of scope, deliberately

- **Splitting `CompetitorInsights.tsx`** (750 lines: watchlist CRUD + chart
  geometry + heatmap grid + CSV export). The right next move, but it is where
  behaviour drift would actually hide, and it is a restructuring rather than a
  consolidation.
- **Unifying the `CARD` / `FIELD` Tailwind constants.** They read as drift but
  genuinely differ — `rounded-xl p-lg` with a lift on Competitors,
  `rounded-xl p-md md:p-xl` on Settings, `rounded-lg p-md` on Overview.
  Unifying them changes pixels.

## Verification

The refactor is one pass; the confidence comes from the pass after it.

1. `npx vitest run` — green, at the real file count after the worktree exclusion
2. `npx tsc --noEmit`
3. `npm run build`
4. `tests/date.test.ts` (new) — locks every `lib/date.ts` helper's output, so the
   move rests on assertions rather than on a careful reading
5. Call-site-by-call-site diff review against the originals
6. Browser check on the four pages touched: Overview, Competitors, Settings,
   Calendar

## Risks

| Risk | Mitigation |
|---|---|
| A formatter's options silently change, altering rendered text | Options copied per call site, not merged; `rules.test.ts` asserts exact strings; new `date.test.ts` locks each helper |
| A route's error shape changes | `propertyFromRequest` returns the byte-identical body and status; `hotel-search` keeps its own `property` variable naming |
| Deleting a component that is reachable by a path the import scan missed | `next build` resolves the full route graph; a missed reference fails the build |
| Store key drift orphans live data | `propKey.bundleLatest` emits the same string; asserted in review |
