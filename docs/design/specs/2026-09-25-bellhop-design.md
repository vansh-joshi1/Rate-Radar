# Bellhop — design

**Date:** 2026-09-25
**Status:** approved
**Scope:** replaces the sample-data "AI strategy" page (`/analytics`) with Bellhop, a
chat assistant that answers questions about the engine's own numbers, and starts
recording tonight's rooms-booked count.

## Why

The AI strategy page is mostly placeholder: hardcoded stats, a fake chart, and demo
event rows. Only the history table is real. Operators ask questions the dashboard
answers only indirectly — "why is tonight this price?", "what if I charge $X?", "what's
coming up?" — and the engine records the rate charged but never how many rooms sold,
which is the data any future forecast would need.

## What Bellhop is, and is not

- It **explains the deterministic engine**; it does not produce prices. Every number it
  quotes comes from the snapshot, history, or bookings it is handed.
- **What-if answers compare, never predict.** "$X is $12 under tonight's low end, $8
  under the compset median, on a meaningful-event night." It never states an occupancy
  or revenue forecast — the engine has no demand model, and inventing one is the fake
  precision PRODUCT.md rules out.
- It never implies it can change a price anywhere.
- A future deterministic forecast (built on the bookings collected here) plugs in as one
  more context input; Bellhop then narrates it. Out of scope now.
- Answering questions beyond the site's data is a later phase, out of scope now.

## Decisions

| Decision | Choice |
|---|---|
| Model provider | Google Gemini (Flash) via AI Studio, free tier. Not Claude. Current model id and limits are verified at build time. Free tier allows Google to use prompts for training — accepted; moving to paid is a key change. |
| Where it lives | Replaces `/analytics`. Nav label changes from "AI strategy" to "Bellhop". |
| Who can use it | Every signed-in role (`viewer`+) can ask and can record tonight's bookings. |
| Rooms-booked capture | Bellhop asks about **tonight** (on-the-books count), not last night. Recorded through a structured number input inside the chat, never parsed by the model. |
| Chat history | Browser session only. Not stored server-side. |
| Demo sandbox | Bellhop works, capped at 10 questions per sandbox per day. |

## Components

| File | Responsibility |
|---|---|
| `lib/properties.ts` | `Property` gains `totalRooms: number`. Franklin gets its real count (from the owner); the demo hotel an invented one. |
| `app/onboarding/page.tsx` | The mock gains a "Number of rooms" field on the Property step. Still a mock — it persists nothing. |
| `lib/bellhop/context.ts` | Builds the system prompt: rules above, tonight's date in the property timezone, `totalRooms`, the latest snapshot (nights, tiers, ranges, events, `reasoning[]`, weather/holiday/BNA notes, compsets, parity), the last 30 history records with actuals, and tonight's booking readings. |
| `lib/bellhop/gemini.ts` | The only file that knows the provider. Takes system prompt + messages, returns a text stream. |
| `app/api/bellhop/route.ts` | POST `{ messages }`. `requireRole('viewer')`. Demo callers counted against the daily cap. Streams text back. |
| `app/api/bookings/route.ts` | POST `{ rooms }`. `requireRole('viewer')` — the one write a viewer may make. zod: integer, `0 ≤ rooms ≤ totalRooms`. The date is always tonight in the property timezone, computed server-side. Appends `{ rooms, at }` to `bookings[tonight]` in `requestStore()`. |
| `app/(app)/analytics/page.tsx` + `components/Bellhop.tsx` | Starter questions, the chat, and the "How many of your N rooms are booked for tonight?" card when tonight has no reading (or an "update" link when it does). The real history table stays below. Fake stats, chart and demo event table are deleted. |
| `components/shell/AppShell.tsx` | Nav label → "Bellhop". |

## Data

`bookings` — `Record<date, { rooms: number; at: string }[]>`, stored through
`requestStore()` beside `actuals`. Readings append; the latest reading is tonight's
figure; earlier ones are booking-pace history.

## Failure handling

- Missing `GEMINI_API_KEY`, provider error, or rate limit: "Bellhop is unavailable right
  now. The recommendations on the dashboard are unaffected." The booking card still
  works — it never touches the model.
- No snapshot yet: Bellhop is told so and says there is no data to answer from.
- Demo cap reached: an honest message naming the cap.

## Tests

- `bookings` route: rejects negatives, non-integers, and counts above `totalRooms`;
  appends rather than overwrites; always writes tonight's date.
- `context.ts`: a sample snapshot yields a prompt containing tonight's recommendation and
  its reasoning lines, and the no-snapshot case says so.
- `tests/role-guard.test.ts` covers both new routes automatically.
