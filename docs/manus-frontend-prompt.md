# Manus Design Prompt — "Rate Radar" SaaS Frontend

Copy everything below the line into Manus.

---

## The task

Design and build the complete frontend UI for **Rate Radar**, a SaaS revenue management system for small independent hotels and motels. It recommends nightly room rates from demand signals (local events, holidays, weather, competitor prices), monitors rate parity across booking sites (our own site, Expedia, Booking.com, Google Hotels), and alerts the owner when something needs attention. **It never changes prices automatically — it recommends, a human decides.** That principle should be visible in the product's voice.

Target users: independent hotel owners and small revenue managers — practical people, not analysts. The UI must make a recommendation understandable in 10 seconds, with the reasoning one glance away.

## Deliverable format (important — this will be ported into a Next.js app)

- **Static HTML + CSS only.** One `.html` file per page listed below, sharing a single `styles.css`. Vanilla JS only where needed for demo interactivity (tab switches, dropdown open/close).
- **No frameworks, no Tailwind, no Bootstrap, no external UI kits, no icon fonts, no CDN links.** Inline SVG for any icons. System-safe Google Fonts are OK via one `<link>`.
- All theming through **CSS custom properties on `:root`**, with a complete dark theme via `@media (prefers-color-scheme: dark)`.
- Fully responsive: sidebar collapses to a top bar / hamburger below ~820px; tables scroll horizontally in their own container, never the page.
- Use the realistic placeholder data given below — real hotel names, real dollar amounts, real event names. No "Lorem ipsum".

## Design direction

The current internal tool uses a "motel ledger" aesthetic worth evolving, not discarding: warm paper background (`#f6f1e7`), ink text (`#241f16`), one committed accent red (`#c8102e`), an editorial serif (Fraunces) for the big numbers, a workmanlike sans (Archivo) for everything else, double-rule dividers like a printed rate card, stamped-looking status chips. Keep that character but make it feel like a polished multi-tenant product rather than a single hotel's intranet page. Big rate numbers in serif remain the hero of every screen.

## Pages to design (12 screens)

### Public / marketing
1. **`landing.html`** — Marketing homepage. Hero with product one-liner ("Know what to charge tonight"), a product screenshot placeholder area, 3–4 feature blocks (rate recommendations with transparent reasoning, parity monitoring, event radar, email alerts), a "how it works" strip, pricing section (3 tiers: Free / Pro $29/mo / Portfolio $79/mo), footer. Nav with Login / Start free.
2. **`login.html`** — Sign in. Email + password, "magic link" alternative, link to signup.
3. **`signup.html`** — Create account. Name, email, password, then a hint of the onboarding to come.
4. **`onboarding.html`** — First-run wizard (single page, 3 visible steps): ① add your property (name, address, brand, room tiers with baseline weekday/weekend rates), ② paste your listing URLs (own site, Expedia, Booking.com), ③ pick competitor hotels for the compset. Show step 2 as the active state.

### Authenticated app (shared shell: left sidebar + topbar)
The shell has: product wordmark; a **property switcher** dropdown in the topbar (show two properties: "Red Roof Inn — Franklin, TN" active, "Sunrise Suites — Cookeville, TN"); nav sections **Overview, Rate Calendar, Parity, Competitors, Analytics, Alerts, Settings**; user menu bottom-left with plan badge ("Pro"), Sign out.

5. **`overview.html`** — The daily dashboard. Hero card: tonight's recommended rate per room tier (Standard $89, Superior $104), range, uplift vs baseline, confidence meter (78%), and a bulleted "why" reasoning list. Below: a manual note box ("things no feed knows about"), data-freshness line, and warning strips for stale data / failed sources (show one warning as an example).
6. **`calendar.html`** — Rate calendar: next 21 nights as a table or calendar grid. Per night: demand signal chip (quiet / minor / meaningful / major), recommended rate per tier, uplift %, top demand driver ("Morgan Wallen @ Nissan Stadium", "Vandy vs. Georgia", "CMA Fest", "no demand signal"). Include one holiday row (Labor Day) and a couple of "event judged too small to matter" rows shown with that verdict.
7. **`parity.html`** — Rate parity monitor: card per source (our site direct, Expedia, Booking.com, Google Hotels-informational) with the price found, room name, screenshot-timestamp; one source in "needs manual check" state with an explanatory note (bot-blocked pages are expected, it's a truthful state not an error). A "$12 gap" alert badge when sources disagree, and a 30-day parity-gap history sparkline.
8. **`competitors.html`** — Compset: table of ~7 nearby competitor hotels with tonight's price, sorted; median highlighted; our position marked. A second block for a future date. Controls to add/remove hotels from the whitelist.
9. **`analytics.html`** — Revenue analytics: recommended vs. actually-charged over time (line chart placeholder), acceptance rate ("you followed the recommendation 71% of nights"), estimated revenue impact, event-night performance table. Charts can be static SVG mockups.
10. **`alerts.html`** — Alert center: chronological feed of sent alerts (rate-move recommended, parity gap, big event added, source broken), each expandable; per-alert-type toggles + email recipients config on the side.
11. **`settings.html`** — Tabbed settings: **Property** (details, room tiers, baseline rates), **Team** (member list with roles Owner / Revenue Manager / Viewer, invite by email), **Billing** (current plan card, Stripe-style payment method row, invoice history table), **API & Data** (ingest webhook URL + secret, collector schedule readout). Show the Billing tab active.
12. **`admin.html`** — (Bonus, internal) multi-property portfolio view: one row per property with tonight's rec, occupancy note, parity status, alerts count.

## Placeholder data to use

- Property: Red Roof Inn, Franklin TN. Room tiers: Standard (baseline $79 weekday / $94 weekend) and Superior (+$15).
- Tonight: Standard **$89** (range $84–$94), Superior **$104**, +12% over baseline, confidence 78% — "3 of 4 rate sources fresh, event data 2h old".
- Reasoning bullets: "Friday baseline $94 · Morgan Wallen @ Nissan Stadium (score 82, major) → +18% · downtown absorbs most, distance dampener −6% · compset median $96 supports the range · Vanderbilt home game (score 11) judged too small to matter — shown, not applied".
- Parity: direct $89, Expedia $101 (+$12 gap flagged), Booking.com $99, Google Hotels "needs manual check".
- Compset hotels: Quality Inn Franklin $79, Baymont $84, La Quinta Cool Springs $92, Comfort Inn $95, Holiday Inn Express Berry Farms $109, Hampton Inn Franklin $119, Aloft Cool Springs $124. Median $95.
- Alert examples: "Recommended rate moved $84 → $89 (+$5) — new event: Morgan Wallen 8/14", "Parity gap $12: Expedia above direct", "Source broken: MCC calendar parse failed".

## What to avoid

- No auto-pricing language ("we optimize your prices for you") — the product recommends, humans decide.
- No dense BI-tool look; this is for a motel owner at a front desk, possibly on a phone at 11pm (dark mode matters).
- No fake precision — confidence, "needs manual check", and "too small to matter" states are first-class UI citizens, not error states to hide.
