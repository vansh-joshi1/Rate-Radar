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
interface Limits { bellhop: boolean; maxComps: number | null; historyDays: number }  // null = no cap
limitsFor(account: Account, propertyId: string): Limits
```

- Exempt property → `{ bellhop: true, maxComps: null, historyDays: 365 }`.
- `account.plan` set → that plan's row.
- No plan (on trial) → Growth's row.

```ts
const PLAN_LIMITS = {
  starter: { bellhop: false, maxComps: 4, historyDays: 90 },
  growth:  { bellhop: true,  maxComps: 8, historyDays: 365 },
};
```

It never decides locked or open; `access()` still does that. Browser-safe:
`Account` imported as a type only.

## Enforcement

1. **Bellhop.** `/api/bellhop` returns 402 `{ error: 'Bellhop is on the Growth plan' }`
   after `requireRole('viewer')`. On Starter the Bellhop page (`/analytics`) renders an
   upgrade panel in place of the chat: owners get a link to Settings → Billing, everyone
   else "Ask your hotel's owner to move to Growth." The nav item stays.
2. **Competitor cap.** `POST /api/watchlist` returns 402
   `{ error: 'Starter tracks up to 4 competitors, Growth 8.' }` once the list is at the
   cap. The Competitors page shows "3 of 4 tracked" and disables Add at the cap; no count
   is shown when there is no cap. The onboarding request schema drops from
   `.max(40)` to `.max(8)`.
3. **History window.** `frontend/app/(app)/competitors/page.tsx` loads the dates within
   the last `historyDays` calendar days instead of `slice(0, 90)`. The chart already plots
   what it is given. `/api/data` keeps its 60 entries, below both limits.

## Trim on downgrade

In the billing webhook, after `saveAccount`, for each of the account's properties:

1. Load the watchlist from `storeFor(propertyId)`. If it fits `limitsFor(...).maxComps`,
   stop.
2. Keep the `maxComps` oldest by `addedAt`, save, and store
   `prop:{id}:watchlist:trimmed` = `{ removed: string[], at: string }`.
3. Email the hotel's owners (the same lookup `ingest.ts` uses for alerts) a new
   `compsTrimmedEmail(removed)` from `backend/lib/email/messages.ts`, naming the removed
   hotels and saying Growth tracks 8.

The Competitors page shows the stored note ("On Starter we track 4 competitors, so we
removed …"). Each viewer dismisses it in their own browser (localStorage keyed by
`at`); there is no dismiss route.

Retries are safe: a trimmed list is under the cap, so a repeated event removes nothing
and sends nothing. A failed email is logged and does not fail the webhook, since the
in-app note still shows.

## Components

| File | Change |
|---|---|
| `backend/lib/billing/limits.ts` | New. `PLAN_LIMITS`, `limitsFor()`. |
| `backend/lib/watchlist.ts` | `trimWatchlist(hotels, max)` → `{ kept, removed }`, oldest kept. |
| `backend/lib/email/messages.ts` | `compsTrimmedEmail(removed)`. |
| `frontend/app/api/billing/webhook/route.ts` | Runs the trim after saving the account. |
| `frontend/app/api/bellhop/route.ts` | 402 on Starter. |
| `frontend/app/(app)/analytics/page.tsx` | Upgrade panel on Starter. |
| `frontend/app/api/watchlist/route.ts` | 402 on POST at the cap. |
| `frontend/app/(app)/competitors/page.tsx` | History by `historyDays`; passes cap, count and trim note. |
| `frontend/components/CompetitorInsights.tsx` | "n of cap tracked", disabled Add, trim note. |
| `backend/lib/access-requests.ts` | Competitors `.max(8)`. |
| `frontend/app/page.tsx` | Starter gains "Competitor benchmarking, up to 4 comps" and the event-intelligence line; Growth loses the event line; "13-month" becomes "12-month". |
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
