# Bellhop — outside questions

**Date:** 2026-09-30
**Status:** approved
**Scope:** Bellhop also answers what a guest asks the front desk ("where's good BBQ?",
"how far is Bridgestone Arena?") and what an operator wants to know about the outside
world ("is I-65 closed?"), from Google Search grounding with its sources shown. Extends
[2026-09-25-bellhop-design.md](2026-09-25-bellhop-design.md), which left this out of scope.

## Who asks

Staff, on the signed-in Bellhop page, sometimes on a guest's behalf. Guests never use
Bellhop directly; a public guest-facing surface is a different product.

## Two kinds of answer, one rule each

- **Rate Radar questions** — rates, what-ifs, events on the calendar, compset, parity,
  bookings: from the DATA only, exactly as before. That includes **every price**: "what's
  the Hampton charging tonight?" comes from the compset or gets "I don't have that",
  never a figure off a web page. An unmetered web price next to the metered compset
  would look just as trustworthy and isn't.
- **Everything else** — guest questions, local conditions, general how-to: from search
  results only, shown with their sources. Nothing found → say so. Never from memory:
  a restaurant that closed last year, passed to a guest at the counter, is the failure.
- **Where they overlap, the DATA wins.** An event search finds that the calendar lacks
  is reported as not in Rate Radar's calendar and not moving tonight's number, with a
  pointer to the dashboard note field — the existing home for what no feed knows.
- The price rules stand: no occupancy or revenue prediction, never implying a rate is set.

## When search is off

- **Demo:** no search tool. Kestrel Bay is invented; a search would find nothing, or
  real businesses near the demo's coordinates, and break the fiction. Outside questions
  get "that works for a real hotel, not the demo". It also keeps demo traffic off the
  shared quota.
- **Quota exhausted or grounding error:** one retry without search, with a line in the
  system prompt saying search is off for this answer. Rate questions still work; outside
  questions get "I can't look that up right now".

## Provider facts (verified 2026-09-30)

- **Grounding is not on the free tier** ("Not available" in the pricing page's free
  column; a free-tier key gets 429 on every grounded call). It needs Cloud Billing on
  the Gemini project. The paid tier includes 5,000 grounded search requests a month,
  shared across all Gemini 3.x models and every hotel on the key; then $14 per 1,000.
  Flash-Lite supports grounding. Until billing is on, every outside question takes the
  "search is off" path below, which works on the free key.
- Terms: grounded results are shown **with their Search Suggestions**, unmodified, with
  nothing interspersed; links go straight to their destination.
- `@google/genai` 2.24.0: `config.tools: [{ googleSearch: {} }]`; sources in
  `candidates[0].groundingMetadata.groundingChunks[].web`, suggestions HTML in
  `groundingMetadata.searchEntryPoint.renderedContent`.

## Components

| File | Change |
|---|---|
| `lib/bellhop/gemini.ts` | `streamReply(system, turns, { search })`. Order: Flash + search, Flash-Lite + search, then Flash without search and the "search is off" line. Yields text, then one final `grounding` — sources `{ title, uri }`, one per site, and the suggestions HTML. Still the only file that knows the provider. |
| `lib/bellhop/context.ts` | RULES splits into the two kinds of answer. `web: false` (demo) adds the no-search line. |
| `app/api/bellhop/route.ts` | `search` is off for demo callers. Streams text as before, then `\x1e` and the grounding as JSON. Still `text/plain`. |
| `components/Bellhop.tsx` | Splits the stream at `\x1e`. A grounded answer shows a "Sources" row of links and Google's suggestions block as given, in a sandboxed `srcdoc` iframe (its CSS can't leak; `<base target="_blank">` so a click never loses the chat). A fourth starter, "Where can a guest get dinner nearby?", outside the demo; outside the demo the intro message also offers guest lookups. Under the composer: "Don't include guest names or personal details." Every question goes to Google. |

## Tests

- Grounding extraction against the SDK metadata shape: one source per site, the
  suggestions HTML passed through untouched, nothing when there is no metadata.
- `buildSystemPrompt`: carries the prices-only-from-DATA rule; the demo prompt says search is off.
- `tests/role-guard.test.ts` keeps covering the route.
