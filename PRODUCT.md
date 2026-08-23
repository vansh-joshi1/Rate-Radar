# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Rate Radar is a multi-tenant SaaS product for **small independent hotels and motels**. Red Roof Inn Franklin, TN (RRI1430) is the first and currently only live property — a reference customer, not the product's identity.

Four confirmed audiences, all real:

- **Owner / operator at a desk** — the primary scene. Back office, once or twice a day, with time to read the reasoning, adjust baselines, and decide. Design assumes this user first.
- **Front desk staff mid-shift** — at the counter between guests, checking tonight's number. Interruption-tolerant, shared machine, glances rather than sessions.
- **A revenue manager who lives in the tool** — wants density, history, comparisons, and the ability to second-guess the model. Will not accept a number they cannot interrogate.
- **The owner on a phone, off-hours** — secondary, but not optional. Phone is not the primary surface; every surface must still work on one.

Permissions are three server-enforced roles: `viewer` (read dashboard, compset, history, API docs), `manager` (adds baseline/current rates, watchlist, notes, recorded actuals, recompute, on-demand collection), `owner` (adds invite/remove teammates). The owner is whoever `OWNER_EMAIL` names, always.

## Product Purpose

Tell a hotel operator what to charge tonight, and show them why.

It recommends a nightly rate per room tier from day-of-week patterns, nearby demand events, weather, and holidays; checks the property's own listed rate across four public sources for parity; and emails an alert only when something actually merits attention.

**It never changes a price anywhere. It recommends — a human decides.** This is the load-bearing product fact, not a disclaimer. It governs voice, control placement, and every default across the product.

Success is an operator who trusts the number enough to act on it, and who can defend that action to themselves afterward.

## Positioning

Three things a neighboring product could not truthfully copy:

- **Deterministic, auditable scoring.** Every event gets an overflow-likelihood score (draw size vs. what downtown Nashville absorbs × travel-draw × day-of-week, compounded with diminishing returns for same-night events). The arithmetic is inspectable, not a model output.
- **Rejected signals are shown with their verdict, never silently dropped.** An event judged too small to matter appears in the UI saying exactly that. The product argues its case including the parts that didn't move the number.
- **Recommendation-only, by design and permanently.** Competitors in revenue management sell automation. This sells a defensible opinion and leaves the operator holding the decision.

Its data comes from its own scraping pipeline rather than a third-party rate-data API — which is both a cost position and a fragility the product is honest about.

## Operating Context

- **Collection runs 7×/day Central** (7:00, 10:00, 13:00, 15:00, 18:00, 20:00, 22:00) via GitHub Actions, POSTing a bundle to `/api/ingest`.
- **Sources:** Ticketmaster (3 venues), College Football Data (Vanderbilt), NWS alerts (2 counties), FAA (BNA airport status), university and Music City Center calendars, and Playwright rate checks against the property's own site, Google Hotels, Expedia and Booking.com.
- **Alerts** go out by email (Resend) only when rules fire against the last-emailed state — not on every run.
- **A manual note field exists for what no feed knows** — corporate events at nearby campuses (Nissan NA, CHS) are published nowhere. Human-entered context is a designed part of the pipeline, not a fallback.
- **Onboarding is sales-assisted and permanently so.** A new hotel is configured by a person: an entry in `config/properties.json`, a row in `lib/properties.ts`, listing URLs into secrets, and a deploy. `/signup` is a request-access surface, not account creation; uninvited emails get an honest explanation rather than an account. Existing users arrive by invite and magic link.
- **Scrapers rot as a matter of course.** University calendar pages change structure roughly yearly; the holiday table needs extending annually. A broken source skips that source and the run continues. Maintenance is a scheduled reality of operating this product, not an incident.

## Capabilities and Constraints

**Confirmed capabilities:** nightly rate recommendation per room tier with range, uplift vs. baseline, and confidence; transparent per-night reasoning; 21-night forward rate calendar with demand-signal tiers (quiet / minor / meaningful / major); rate parity monitoring across four sources; compset tracking against an editable competitor whitelist; recorded actuals and acceptance history; manual notes; email alert center; team management with roles; a public read API (`/api/v1/*`) authenticated by API key.

**Hard constraints future work must preserve:**

- The product never writes a price to any external system. No surface may imply it does.
- Role enforcement is server-side in the route handler (`requireRole()` in `lib/auth/guard.ts`). Hiding a control in the UI is courtesy; `tests/role-guard.test.ts` fails the build if a mutating route ships without a check.
- **Parity checks are best-effort against bot-protected pages.** "Needs manual check" is expected behavior and a truthful state — never styled or worded as an error.
- Compset acts as a sanity bound on quiet nights only. **Event nights are never capped by compset.**
- Google Hotels' rate for the property's own listing is informational only and is excluded from parity alerts, by owner request.
- Every page currently sets `robots.txt` disallow and `noindex` headers. This conflicts with shipping a public marketing surface and is an unresolved decision, not a settled one.
- Free-tier infrastructure throughout: Vercel Hobby, GitHub Actions, Upstash Redis, Resend. Without a verified sending domain, Resend delivers only to the account owner's own address.
- OTA listing URLs still use pre-rebrand "Days Inn" slugs for the Franklin property; they resolve today but are a known fragility.

**Terminology the product owns:** compset, parity, uplift, baseline, room tier (Standard / Superior), demand signal, overflow-likelihood score, actuals, watchlist, "needs manual check", "too small to matter".

**Explicitly undecided:** commercial model is **paid, with pricing and tier structure genuinely open**. Billing, plans, limits and upgrade paths may be designed as real surfaces; no amount or tier name may be invented to fill them.

## Brand Commitments

- **Name:** Rate Radar. Current metadata tagline: "Know what to charge tonight."
- **Voice:** plain, practical, addressed to an operator rather than an analyst. No auto-pricing language ("we optimize your prices for you") — the product recommends, humans decide. No fake precision.
- **Red Roof Inn branding is customer data, not product identity.** Now that the product is multi-tenant, the property's brand (and its red) must not shape the product's own identity.
- No logo, wordmark, or identity assets have been established as binding.

## Evidence on Hand

**Real:** Red Roof Inn Franklin's own live data — actual recommendations, actual parity checks, actual event scoring, actual recorded history. The running dashboard is honest, demonstrable proof of the product working.

**Does not exist — must never be fabricated:**

- No outside customers, testimonials, case studies, press, partner logos, or third-party benchmarks.
- No measured revenue or occupancy outcome that anyone would stand behind publicly.

**Known placeholders currently rendering in the codebase, which future work must not harden into claims:**

- Pricing tiers Free / Pro $29 per month / Portfolio $79 per month — invented in `docs/manus-frontend-prompt.md` for an external design brief. Not a commercial decision. **Accepted risk, decided 2026-08-19:** the section ships as-is on the landing page, with tier cards and CTAs, on the grounds that every page is `noindex` and access is invite-only, so no stranger reaches it. Do not treat those numbers as product truth, do not propagate them to any other surface, and revisit this before the marketing page is ever made public or indexable.
- "Acceptance rate 71%", "+$1,420 estimated impact", "$4.20 avg. parity gap" — hardcoded in `app/(app)/analytics/page.tsx`.
- "Sunrise Suites — Cookeville, TN" — a demo second property hardcoded in `components/shell/AppShell.tsx`. Not a customer.
- Anything sourced from `lib/demo.ts`.

Illustrative figures on any public surface must be labeled as illustrative.

## Product Principles

1. **Recommend, never decide.** The human holds the decision. Every surface keeps the override cheap and the number arguable.
2. **Show the work.** A recommendation without visible reasoning is worthless to a skeptical operator — and skeptical is the correct default posture for someone risking their own revenue.
3. **Truthful states outrank clean ones.** "Needs manual check", "too small to matter", "source broken", "data is 6h old" are first-class citizens of the interface, not failures to hide.
4. **No fake precision.** Confidence is stated honestly and its basis is visible. The product would rather look uncertain than look wrong.
5. **Readable in ten seconds, defensible in two minutes.** The glance and the interrogation are both real jobs, done by the same person on different days.

## Accessibility & Inclusion

No formal standard has been adopted, and none was established during this interview — this is an open decision, not an absence of need.

Two usage facts bear on it and are confirmed: front-desk staff use shared machines mid-shift, and owners read the product on a phone off-hours. Both argue for generous contrast, large legible numerics, and touch targets that survive a small screen — but no conformance target (WCAG level, keyboard coverage, screen-reader support) has been committed to.
