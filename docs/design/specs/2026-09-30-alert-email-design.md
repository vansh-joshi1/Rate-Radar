# Alert email, readable at a glance — design

**Date:** 2026-09-30
**Status:** approved

## Why

The alert digest says "7 things worth a look" and makes the owner read six equal boxes
of full sentences to find out what happened. A $30 jump on a game night weighs the same
as a scraper that failed three runs, and the game appears twice: once as the rate change
and again as a "new demand driver".

## Layout

1. **Subject:** the biggest rate move, then how many other items. `Sat, Oct 3 → $129 (+$30) · 6 more`.
   With no rate move, the headline plus the count.
2. **Headline:** the largest move, "Raise Sat, Oct 3 to $129" / "Lower Sun, Oct 4 to $94".
   Otherwise the first "Also" item, or "Data problem: …" when data is all there is.
   No intro paragraph.
3. **Nights:** one row per night whose rate moved, in date order: date, new rate (bold),
   "was $99", and the event that drove it. A new event on a night with a row is folded
   into that row.
4. **Also:** one short line each, in this order: parity, events on nights without a row,
   weather, holidays.
5. **Open dashboard** button.
6. **Data:** source failures, recoveries and a low search budget, in small muted text
   under the button.
7. The shell's footer, unchanged.

The plain-text part follows the same order.

## Data

`Trigger` gains optional structured fields so the email builds rows from data:

- rate-change: `rate: { now, was, driver? }`
- new-event: `event: string` (its name)

Every `line` becomes short, since the email is the only reader (ingest also returns the
lines in its summary):

| Type | Line |
|---|---|
| rate-change | `Sat, Oct 3: $129, was $99, Vanderbilt vs Alabama` |
| parity-gap | `Parity: Expedia $89 vs Booking.com $109, $20 spread` |
| new-event | `Vanderbilt vs Alabama, Sat, Oct 3` |
| weather | `Winter Storm Warning, Williamson County` |
| holiday | `Columbus Day, Mon, Oct 12` |
| source-health | `calendars failing since 2026-09-27` / `calendars working again after 5 failed runs` |
| search-budget | `9 SerpApi searches left, resets 2026-09-23` |

## Files

| File | Change |
|---|---|
| `backend/lib/alerts/rules.ts` | Short lines; `rate` and `event` fields. |
| `backend/lib/email/messages.ts` | `alertDigestEmail` rebuilt to the layout above. |
| `backend/lib/email/template.ts` | `nightsTable()` and `dataNote()` helpers; the shell's intro becomes optional. |
| `backend/tests/email.test.ts`, `rules.test.ts`, `source-health.test.ts` | Updated strings; folding test. |

## Out of scope

The trim, sign-in and pipeline-stale emails; alert thresholds.
