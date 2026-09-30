# Plan limits — design

**Date:** 2026-09-30
**Status:** approved
**Scope:** project 2 of 3 from [2026-09-27-stripe-billing-design.md](2026-09-27-stripe-billing-design.md).
Makes Starter and Growth behave differently within one hotel: Bellhop, the competitor
cap and the history window. 4× daily refreshes are split out to their own spec, to be
written once a SerpApi plan is chosen; until then every hotel refreshes twice a day.

## Why

Hotels can pay for Starter or Growth, but nothing reads the plan: a Starter hotel gets
every Growth feature. Two gaps turned up on the way:

- Growth sells a long history view the app never shows. 400 days are stored
  (`history:dates` in `backend/lib/ingest.ts`), but the Competitors chart plots at most
  the last 90 entries.
- Onboarding accepts up to 40 competitors (`backend/lib/access-requests.ts`), and a
  trial hotel is on Growth features, which allow 8.

## Decisions

| Decision | Choice |
|---|---|
| Bellhop | Growth only. |
| Competitors tracked | Starter 4, Growth 8. Starter's cap is new; the landing page and PRODUCT.md gain it. |
| History shown | Starter 90 days, Growth 12 months (365 days). Growth was sold as 13 months; the copy changes to 12. Storage is unchanged, so an upgrade shows the older data at once. |
| Events and event-impact alerts | Same on both plans. The landing line moves from Growth's extras to Starter's list. |
| Trial | Growth limits (it already reads "Trial, Growth features"). |
| Exempt (original property, demo) | Bellhop on, no competitor cap (the original property keeps its 10), 12 months of history. |
| Lapsed hotel | Unchanged: locked by `requireRole()` and the plan wall. |
| Over the cap after a downgrade | Trimmed automatically: keep the oldest by `addedAt`, remove the rest, tell the owners by email and show a note on the Competitors page. |

## Limits

One pure function in `backend/lib/billing/limits.ts`, beside `access()`:

```ts
interface Limits { bellhop: boolean; maxComps: number; historyDays: number }
limitsFor(account: Account, propertyId: string): Limits
```

- Exempt property → Growth, with `maxComps` at the hard ceiling `MAX_COMPS` (25, the cap before plans).
- `account.plan` set → that plan's row.
- No plan (on trial) → Growth's row.

```ts
const PLAN_LIMITS = {
  starter: { bellhop: false, maxComps: 4, historyDays: 90 },
  growth:  { bellhop: true,  maxComps: 8, historyDays: 365 },
};
```

It never decides locked or open; `access()` still does that. `PLAN_LIMITS` lives in the
browser-safe `plans.ts` beside `PLAN_PRICES`, so client components read the numbers too.

## Enforcement

1. **Bellhop.** `/api/bellhop` returns 402 `{ error: 'Bellhop is on the Growth plan' }`
   after `requireRole('viewer')`. On Starter the Bellhop page (`/analytics`) renders an
   upgrade panel in place of the chat: owners get a link to Settings → Billing, everyone
   else "Ask your hotel's owner to move to Growth." The nav item stays.
2. **Competitor cap.** On Starter, `POST /api/watchlist` returns 402
   `{ error: 'Starter tracks up to 4 competitors, Growth 8.' }` once the list is at the
   cap; Growth's and the hard ceiling's cap return 400, since no payment lifts them. The
   Competitors page shows "3 of 4 tracked" (it already showed "of 25") and disables
   Add at the cap. The onboarding request schema drops from
   `.max(40)` to `.max(8)`; the onboarding picker disables further picks at 8 and says why.
3. **History window.** `frontend/app/(app)/competitors/page.tsx` loads the dates within
   the last `historyDays` calendar days through `recentHistory()`, reading the `history` hash in one query instead of
   one per day. `/api/data` keeps its 60 entries, below both limits.

## Trim to the cap

`enforceCompCap(account, propertyId, store?)` (in `limits.ts`) holds one hotel to its
cap. It runs in two places: in the billing webhook after `saveAccount`, once per hotel
on the account, and in `processBundle` (ingest and recompute) right after the
property-token write and before the watchlist bounds that run's compset. The second
catches lists the webhook never sees: hotels onboarded under the old 40-competitor
limit, Starter subscriptions from before this shipped, and a trim that the token write
just undid. It sits on the ingest POST, not on the collector's GET of the hotel list,
so a collector dry run (which never POSTs) changes nothing. The original property and
the demo are skipped. For the hotel:

1. Load the watchlist. If it fits `limitsFor(...).maxComps`, stop, first deleting any
   note from a trim to a lower cap (`Store.del`).
2. Keep the `maxComps` oldest by `addedAt`, save, and store
   `prop:{id}:watchlist:trimmed` = `{ removed, max, at }` for 30 days.
3. Email the hotel's owners (`ownersOf()`, shared with ingest's alert mail) a
   `compsTrimmedEmail` naming the removed hotels, adding "Growth tracks 8" only when the
   cap is below Growth's.

The Competitors page shows the note only while the hotel is still on the cap it was
trimmed to, and the note is deleted once the hotel is on a higher one, so it neither
lingers after an upgrade nor returns after a later downgrade. Each viewer dismisses it
in their own browser (localStorage keyed by `at`); there is no dismiss route. Approving
an access request saved before the cap also slices its competitors to 8.

Repeats are safe: a trimmed list is under the cap, so a repeat removes nothing and
sends nothing. A failed trim is logged and does not fail the ingest; a failed email is
logged and fails neither the webhook nor the ingest, since the in-app note still shows.

## Plan limits on the gate

`requireRole()` already reads the account to decide locked or open, so it returns the
caller's `limits` on success and the Bellhop and watchlist routes read them from the gate
instead of a second lookup. Pages share one read per render through `requestAccount()`
(React `cache`), used by the app layout and `limitsForProperty()`.

## History retention

Ingest keeps 400 days (`HISTORY_KEPT` in `backend/lib/history.ts`) and now drops the
records that fall off `history:dates` from the `history` hash too (`Store.hdel`, backed by
`kv_hdel` in `supabase/migrations/0003_kv_hdel.sql`), so the one-query read on the
Competitors page stays bounded. A failed prune is logged and does not fail the ingest.

## Components

| File | Change |
|---|---|
| `backend/lib/billing/plans.ts` | `PLAN_LIMITS`. |
| `backend/lib/billing/limits.ts` | New. `EXEMPT_LIMITS`, `limitsFor()`, `requestAccount()`, `limitsForProperty()`, `enforceCompCap()`. |
| `backend/lib/auth/guard.ts` | Returns `limits` on success. |
| `backend/lib/auth/members.ts` | `ownersOf()`, shared by ingest alerts and the trim email. |
| `backend/lib/history.ts` | New. `HISTORY_KEPT`, `recentHistory()`. |
| `backend/lib/store.ts`, `supabase/migrations/0003_kv_hdel.sql` | `hdel`, `del`. |
| `backend/lib/ingest.ts` | Enforces the cap before the compset; prunes `history` with `history:dates`. |
| `frontend/app/api/admin/approve/route.ts` | Seeds at most 8 competitors. |
| `backend/lib/watchlist.ts` | `trimWatchlist(store, propertyId, max)` → removed names, oldest kept; writes the note. |
| `backend/lib/email/messages.ts` | `compsTrimmedEmail(removed)`. |
| `frontend/app/api/billing/webhook/route.ts` | Runs the trim after saving the account. |
| `frontend/app/api/bellhop/route.ts` | 402 on Starter. |
| `frontend/app/(app)/analytics/page.tsx` | Upgrade panel on Starter. |
| `frontend/app/api/watchlist/route.ts` | At the cap: 402 on Starter, 400 otherwise. |
| `frontend/app/(app)/competitors/page.tsx` | History by `historyDays`; passes cap, count and trim note. |
| `frontend/components/CompetitorInsights.tsx` | "n of cap tracked", disabled Add, trim note. |
| `backend/lib/access-requests.ts`, `frontend/app/onboarding/page.tsx` | Competitors capped at 8. |
| `frontend/app/page.tsx` | Starter gains "Competitor benchmarking, up to 4 comps" and the event-intelligence line; Growth's comp line becomes "Up to 8 comps per property" and loses the event line; "13-month" becomes "12-month". |
| `PRODUCT.md` | Commercial model: 4 comps on Starter, events on both plans, 12-month history. |

## Testing

- `limits.test.ts`: Starter, Growth, trial, exempt.
- `watchlist` trim: keeps the oldest, a list at or under the cap is untouched.
- Route tests: Bellhop and watchlist POST return 402 on a Starter account.
- Manual, once: with Stripe test keys, subscribe Growth, add 6 competitors, switch to
  Starter in the portal, confirm 4 remain, the email arrives and the note shows.

## Out of scope

- 4× daily refreshes for Growth (its own spec, after choosing a SerpApi plan).
- Multi-hotel accounts and the rollup dashboard (project 3).
