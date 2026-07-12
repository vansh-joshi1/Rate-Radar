# Rate Radar — design spec

Date: 2026-07-12 · Status: approved by Vansh 2026-07-12

## Purpose

Internal website for the Red Roof Inn Franklin, TN (RRI1430, 3915 Carothers Pkwy, Franklin TN 37064). Recommends a nightly room rate from day-of-week patterns, nearby demand events, weather, and holidays; checks the property's own listed rate across three public sources to catch pricing drift; emails alerts when something merits human attention. **Recommendation only — never changes a price anywhere.**

## Non-goals

- No automatic price changes on any channel.
- No multi-user auth (single shared password).
- No sourcing of private corporate events (Nissan NA, CHS campuses) — manual note field only.
- No averaging of rate sources — per-source reporting; gaps are the signal.

## Verified context

- Property: RRI1430. OTA listings use legacy Days Inn slugs (pre-rebrand) but resolve to the current Red Roof Inn listing. All three user-provided URLs valid.
  - Direct: redroof.com checkout for destId=RRI1430
  - Expedia: `Nashville-Hotels-Days-Inn-By-Wyndham-Franklin-Nashville.h42914.Hotel-Information`
  - Booking.com: `hotel/us/franklin-3915-carothers-parkway-days-inn-franklin.html`
  - Google Hotels: resolved by property-name search at scrape time (no stable public URL).
- Vercel KV is discontinued; storage is **Upstash Redis via Vercel Marketplace** (free tier, env vars auto-injected, Redis API).
- FAA airport status: `https://nasstatus.faa.gov/api/airport-status-information` (XML, no key) — confirmed live.
- NWS: `api.weather.gov` requires a descriptive `User-Agent` header. Franklin is Williamson County (alerts checked for Williamson + Davidson).
- Ticketmaster Discovery API + collegefootballdata.com (CFBD) need free keys. CFBD key received from user (env only, never committed). Ticketmaster key pending.
- Resend free tier without a verified domain delivers only to the Resend account owner's email. User has no domain → `ALERT_EMAIL_TO` env var, set to account owner's address; Yahoo address can be swapped in later if a domain is verified.

## Baseline rates (config, user-editable — `config/rates.json`)

| Tier | Weekday | Weekend | Busy ceiling |
|---|---|---|---|
| Standard (handicap, non-smoking king, double, superior king) | $68–72 | $80–90 | — |
| Queen | $80 | $95 | ~$120 |

Model outputs one **uplift % per night** (0–40% cap), applied to both tiers. Floor = baseline weekday/weekend value; the 40% cap is anchored to the observed queen busy-day ceiling (~26% over weekend base) plus headroom.

## Architecture

- **Vercel (Hobby), Next.js App Router**: dashboard UI, API routes, Upstash Redis.
- **GitHub Actions**: scheduler + all data collection (including Playwright). Dumb collector — gathers raw data, POSTs to Vercel `/api/ingest`. All scoring/diffing/alert logic lives server-side in the ingest handler (single brain, KV-adjacent).
- **Resend**: transactional alert emails, triggered from the ingest handler.
- Accounts (Vercel, GitHub, Resend) to be created under a hotel/family business identity — README requirement, not code.

### Scheduling

7 runs/day Central: 07:00, 10:00, 13:00, 15:00, 18:00, 20:00, 22:00. GitHub cron is UTC and DST-unaware, so the workflow schedules **both** candidate UTC hours for each CT slot (UTC−5 and UTC−6); the job's first step computes current Central hour and exits unless it matches a target slot. No duplicates, correct year-round. Cron minutes offset from :00 (GitHub delays top-of-hour jobs).

## Data flow

1. Action run: collectors execute in isolation (Promise.allSettled semantics). Each returns `{source, status: ok|failed|awaiting-key, data|error, fetchedAt}`.
2. Action POSTs the raw bundle to `POST /api/ingest` with `Authorization: Bearer ${INGEST_SECRET}`.
3. Ingest handler: scores events per night for today + 21 nights → computes uplift, $ recommendation per tier, $ range, confidence → diffs against last snapshot + last-emailed state → stores snapshot → evaluates alert rules → sends at most one email → returns summary (logged in Action output).
4. Dashboard reads latest snapshot + history from Redis via `GET /api/data` (password-gated).

## Redis data model

| Key | Content |
|---|---|
| `snapshot:latest` | full latest snapshot JSON |
| `snapshot:{date}:{runId}` | per-run snapshots (30-day TTL) |
| `history` | list: per-day final recommendation records |
| `actual:{date}` | manually entered actually-charged rate |
| `note:{date}` | manual free-text note |
| `alert:fingerprints` | hash: alert dedupe fingerprints → last-sent value + timestamp |
| `emailed:state` | last-emailed recommendation vector (rate-change diffs computed against this) |
| `events:seen` | set of event IDs already alerted on |

## Event scoring model

Per event, overflow-likelihood score 0–100:

1. **Base draw**: `S₀ = 100 × (attendance / (attendance + K))`, K = 25,000 — sublinear vs. downtown Nashville absorbable capacity (~20k downtown-core rooms reference). Attendance = venue capacity × expected-fill heuristic (sellout markers, multi-night runs boost fill).
   - Nissan Stadium ~69k · Geodis Park ~30k · Bridgestone ~17k · FirstBank Stadium (Vandy) ~34k · Music City Center events use published/estimated attendance, default 5k if unknown · club/theater (<2.5k) scores ≈ single digits.
2. **Travel-draw multiplier** 0.2–1.5: touring headliner at stadium/arena 1.2–1.5; marathon/large convention/graduation/move-in 1.2–1.4; standard arena sports (Preds regular season) 0.6; local-audience events 0.2–0.4. Classified by venue + Ticketmaster classification + keyword rules; conservative default 0.5 when unknown.
3. **Day-of-week multiplier**: Fri/Sat 1.0 · Thu/Sun 0.7 · Mon–Wed 0.45.
4. **Compounding** per night: `S = 100 × (1 − Π(1 − sᵢ/100))` — diminishing returns, never a straight sum.
5. **Tiers**: `<15` = "nearby, likely too small to matter" — always displayed with reasoning, zero rate effect. 15–40 minor (displayed, zero rate effect). 40–70 meaningful. 70+ major. Uplift % maps from night score: 0 below 40, then linear 40→100 score onto 5%→40% uplift.

**Pseudo-events**: holidays/long weekends (static table through 2028) and university calendar dates (graduation, move-in, parents' weekend) enter with fixed draw profiles (e.g. Vandy graduation weekend = major, travel-draw 1.4).

**Modifiers (not events)**:
- Weather: severe winter storm → note *possible* short-notice demand (stranded travelers), never auto-negative; severe convective alerts → note + confidence penalty. Weather adjusts confidence and reasoning, not baseline uplift, except winter-storm same-night flag (+small uplift suggestion, clearly labeled speculative).
- BNA: ground stop / major delay program → same-night demand bump flag on today's recommendation.

**Confidence** 0–100: source-completeness (share of collectors that succeeded, weighted by importance) × signal agreement (penalty when key sources are stale >24h). Displayed with plain-language cause ("2 of 3 rate sources down").

**Honest output rule**: every considered event appears in the reasoning with its score and verdict, including "too small to matter" — nothing silently omitted.

## Compset (added 2026-07-12 by owner request)

Nearby-competitor rates are harvested from the same Google Hotels page loaded for the parity check (the "similar hotels" carousel carries prices for the same check-in date, i.e. tomorrow). Competitors are matched against an editable whitelist in `config/compset.json`; prices sanity-bounded $40–$250.

Effect on pricing — **sanity bound, not a driver**: for tomorrow's night only, if nightScore < 40 (no event justification) and recommended > 1.15 × compset median, the recommendation is capped at `max(baseline floor, 1.15 × median)`. Event nights (score ≥ 40) are never capped — comps posted rates before the demand signal, and the premium is the point. Compset entries + median always shown in reasoning and in a dashboard panel. Google's own rate for OUR property remains excluded from parity alerting (informational only, owner request).

## Rate parity checks

Playwright (in Action) against redroof.com, Google Hotels (property-name search), Expedia, Booking.com — user-provided URLs parameterized to check-in = tomorrow, 1 night, cheapest standard room. Each source isolated: success → `{price, room, currency}`; blocked/structure-changed → status `needs-manual-check` with error note. Never guessed, never averaged. Booking/Expedia via **both** (per user's "Both" answer) → 4 total public sources reported side by side.

## Scrapers (calendars)

Vanderbilt academic calendar, Belmont academic calendar, Music City Center events calendar: plain HTTP + cheerio parsing, defensive selectors, per-source try/catch. A failed parse logs a structured warning (`source, url, error, hint`) and skips — never crashes the run. Results cached in the snapshot; university dates parsed once per run but change rarely.

## Alert rules (all triggers in a run collapse into ONE email)

| Trigger | Threshold | Rationale |
|---|---|---|
| Rate change | recommended rate for any night in next 21 days moves **≥$5 or ≥7%** vs. last-emailed state | below $5 on a $70–120 base is rounding noise; diffing vs. last-emailed (not last run) prevents drip alerts |
| Parity gap | **≥$8 or ≥10%** spread across sources, same night | under that is normal OTA fee jitter |
| New meaningful event | first detection at score **≥40** | the same line where rate effect begins |
| Severe weather | NWS severity `Severe`/`Extreme`, Williamson or Davidson | immediate |
| Holiday upcoming | unflagged holiday/long weekend within 14 days | once per holiday |

Dedupe: fingerprint per (trigger-type, subject, value-bucket) in Redis; suppressed 24h unless the value re-crosses the threshold. Email body: affected date(s), new number, one line of why, dashboard link. Resend from `onboarding@resend.dev` (no domain) to `ALERT_EMAIL_TO`.

## Dashboard

1. **Today card**: recommended rate per tier, $ range, confidence, plain-language reasoning incl. too-small-to-matter events.
2. **21-night outlook**: per-night flags (event/weather/holiday signal vs. none), score tier color, uplift.
3. **Rate parity panel**: 4 sources side by side, gap badge when ≥ threshold, "needs manual check" state.
4. **History log**: past recommendations vs. actually-charged (manual entry form per date).
5. **Manual note** for today (corporate-event knowledge).

Privacy: middleware checks signed HMAC cookie; login page takes `SITE_PASSWORD`; `robots.txt` disallow all + `noindex,nofollow` meta on every page.

## Error handling

- Collector isolation (per-source status objects; partial data is normal).
- Ingest validates bundle shape (zod); rejects unauthenticated calls.
- Dashboard renders stale-source warnings ("Booking.com last succeeded 2 days ago").
- Action failure visibility: job summary lists per-source status; non-zero exit only on total collection failure or ingest rejection.

## Testing

- Vitest unit tests: scoring engine (draw curve, multipliers, compounding, tier mapping, uplift mapping) and alert threshold/dedupe logic — the two components that rot silently.
- Fixture-based parser tests for each scraper (saved HTML snapshots) so upstream structure changes fail loudly in CI.
- End-to-end verification: one real collection run; per-source output shown (or reason for failure/awaiting-key).

## Environment variables (`.env.example` with comments)

`SITE_PASSWORD`, `SESSION_SECRET`, `INGEST_SECRET`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash via Marketplace), `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `DASHBOARD_URL`, `TICKETMASTER_API_KEY`, `CFBD_API_KEY`, `NWS_USER_AGENT`, property URLs (`RATE_URL_REDROOF`, `RATE_URL_EXPEDIA`, `RATE_URL_BOOKING`, `GOOGLE_HOTELS_QUERY`).

## Open items

- Ticketmaster API key pending from user (demo run marks source `awaiting-key` until then).
- Repo + Vercel + Resend account creation under business identity is the user's setup step (README-documented).
- Static holiday table maintained through 2028; README notes the annual 10-minute refresh.
