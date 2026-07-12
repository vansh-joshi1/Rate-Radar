# Rate Radar

Internal rate-recommendation and rate-parity site for the **Red Roof Inn Franklin, TN** (RRI1430, 3915 Carothers Pkwy). It recommends a nightly rate from day-of-week patterns, nearby demand events, weather, and holidays; checks our own listed rate on four public sources; and emails an alert when something actually merits attention.

**It never changes a price anywhere. It recommends — a human decides.**

## How it works

```
GitHub Actions (7x/day CT, free)          Vercel (Hobby, free)
┌─────────────────────────────┐          ┌──────────────────────────────┐
│ collector/index.ts           │  POST    │ /api/ingest                  │
│  ├ Ticketmaster (3 venues)   │ ───────► │  ├ score events per night    │
│  ├ CFBD (Vandy football)     │  bundle  │  ├ uplift % → $ per tier     │
│  ├ NWS alerts (2 counties)   │          │  ├ diff vs last-emailed      │
│  ├ FAA (BNA status)          │          │  ├ store snapshot            │
│  ├ Univ/MCC calendars        │          │  └ alert rules → Resend email│
│  └ Playwright rate checks    │          │ Dashboard (password-gated)   │
│    (redroof/google/exp/bkng) │          │ Upstash Redis (Marketplace)  │
└─────────────────────────────┘          └──────────────────────────────┘
```

Scoring is deterministic and transparent: every event gets an overflow-likelihood score (draw size vs. what downtown Nashville absorbs × travel-draw × day-of-week, compounded with diminishing returns for same-night events). Events judged too small to matter are **shown with that verdict**, never silently dropped. Details: `docs/superpowers/specs/2026-07-12-rate-radar-design.md`.

## Setup (once, ~45 minutes)

Use accounts tied to the hotel/family business (a shared family email), not a personal throwaway — this needs to keep running long-term.

### 1. GitHub
1. Create a GitHub account/org for the business, create a **private** repo `rate-radar`, push this code.
2. Repo → Settings → Secrets and variables → Actions → add the secrets listed in `.env.example` under "collector vars": `TICKETMASTER_API_KEY`, `CFBD_API_KEY`, `NWS_USER_AGENT`, `DASHBOARD_URL`, `INGEST_SECRET`, `RATE_URL_REDROOF`, `RATE_URL_EXPEDIA`, `RATE_URL_BOOKING`, `GOOGLE_HOTELS_QUERY`.

### 2. Vercel
1. vercel.com → sign up with the same business account → Add New Project → import the GitHub repo. Framework auto-detects as Next.js; no build config needed.
2. **Storage:** Project → Storage → Create Database → **Upstash (Redis)** from the Marketplace (this replaced the old "Vercel KV" — same thing, same free tier). Link it to the project; it auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Env vars:** Project → Settings → Environment Variables → add `SITE_PASSWORD`, `SESSION_SECRET`, `INGEST_SECRET` (same value as the GitHub secret), `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `DASHBOARD_URL`.
4. Deploy. Note the production URL — that's `DASHBOARD_URL` (set it in both Vercel and GitHub secrets).

### 3. API keys (both free, ~5 min each)
- **Ticketmaster**: developer.ticketmaster.com → create app → copy the **Consumer Key** (the secret is not needed).
- **CFBD**: collegefootballdata.com → API Keys → key arrives by email.

### 4. Resend (email)
1. resend.com → **create the account with the email address that should receive alerts** (see caveat below) → API Keys → create key.
2. ⚠️ **Free-tier caveat:** without a verified domain, Resend only delivers to the account owner's own address, from `onboarding@resend.dev`. That's fine for this use — just create the account with the target address. If you later buy/control a domain: Resend → Domains → verify via DNS, then change `from` in `lib/alerts/email.ts` and set `ALERT_EMAIL_TO` to any list of addresses (e.g. the Yahoo address).

### 5. Site password
`SITE_PASSWORD` is whatever you choose; share it with the family. `SESSION_SECRET` and `INGEST_SECRET`: generate each with `openssl rand -hex 32`. The site also sets `robots.txt` disallow + `noindex` headers on every page — it won't appear in search engines.

## Verifying the pipeline end to end

1. GitHub → Actions → **collect** → Run workflow (manual runs bypass the hour gate).
2. Watch the job log: the collection summary lists each source as ✓ ok / ✗ failed / awaiting-key, then the ingest summary shows nights scored, triggers, email status.
3. Open the dashboard → tonight's recommendation + reasoning should render; the parity panel shows the four sources (some may say "needs manual check" — that's a truthful state, not a bug).
4. To test an email: temporarily lower a threshold in `lib/alerts/rules.ts` (e.g. `RATE_DELTA_USD = 0`), push, run the workflow, restore. Or wait — the first real event/holiday/rate move will send one.
5. Local dev: `npm install && npm run dev` (uses `.data/store.json`, no Upstash needed). Collector locally: `npm run collect -- --dry-run --skip-rates`.

## Schedule

7 runs/day Central: 7:00, 10:00, 13:00, 15:00, 18:00, 20:00, 22:00. GitHub cron is UTC and ignores DST, so the workflow fires at both possible UTC hours and a gate step exits unless the current **Central** hour matches — correct in both CST and CDT, no duplicates. GitHub Actions scheduling can drift by a few minutes at busy times; that's normal.

## Maintenance (the honest list)

- **Holiday table** (`config/holidays.json`): extend once a year (~10 min). CMA Fest dates are estimates until announced — correct them when Nashville publishes dates.
- **Scrapers rot.** University calendar pages change structure roughly yearly. When a source shows "parse failed / structure may have changed" on the dashboard, the selectors in `collector/sources/calendars.ts` (or the constants at the top of `rates.ts`) need a 15-minute refresh. A broken scrape only skips that source — the rest of the run continues.
- **Music City Center** calendar is JavaScript-rendered; the plain fetch may consistently return nothing. If it stays empty, it's a candidate for a Playwright-based fetch in `rates.ts`-style — or just rely on the manual note field for known conventions.
- **OTA listing URLs** still use the pre-rebrand "Days Inn" slugs (the property converted to Red Roof). They resolve correctly today; if Expedia/Booking migrate the listing, update `RATE_URL_*` secrets.
- **Compset** (`config/compset.json`): the competitor whitelist is editable — add/remove hotels as the market changes. Compset is a sanity bound on quiet nights only; event nights are never capped. Google Hotels' rate for OUR property is informational only (excluded from parity alerts by owner request).
- **Rate parity checks** are best-effort against bot-protected pages. "needs manual check" now and then is expected behavior, not failure. If one source says it for days, spot-check by hand.
- **Corporate events** at Nissan NA / CHS campuses aren't published anywhere — that's what the dashboard's manual note field is for.

## Repo layout

`app/` dashboard + API routes · `lib/` scoring, alerts, ingest, store, auth · `collector/` GitHub Actions data collection · `config/` baseline rates + holidays (user-editable) · `tests/` vitest unit + fixture parser tests · `docs/superpowers/` design spec + implementation plan.
