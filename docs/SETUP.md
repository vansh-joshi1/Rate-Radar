# Rate Radar — operator setup

Everything needed to stand up a live deployment and keep it running. If you only
want to see what the product does, use the demo instead — it needs none of this.

Use accounts tied to the hotel/family business (a shared family email), not a
personal throwaway — this needs to keep running long-term.

## Setup (once, ~45 minutes)

### 1. GitHub

1. Create a GitHub account/org for the business, create a **private** repo `rate-radar`, push this code.
2. Repo → Settings → Secrets and variables → Actions → add the secrets listed in `.env.example` under "collector vars": `TICKETMASTER_API_KEY`, `CFBD_API_KEY`, `NWS_USER_AGENT`, `DASHBOARD_URL`, `INGEST_SECRET`, `SERPAPI_KEY`.

### 2. Vercel

1. vercel.com → sign up with the same business account → Add New Project → import the GitHub repo. Framework auto-detects as Next.js; no build config needed.
2. **Storage:** Project → Storage → Create Database → **Upstash (Redis)** from the Marketplace (this replaced the old "Vercel KV" — same thing, same free tier). Link it to the project; it auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Env vars:** Project → Settings → Environment Variables → add `SITE_PASSWORD`, `SESSION_SECRET`, `INGEST_SECRET` (same value as the GitHub secret), `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `DASHBOARD_URL`.
4. Deploy. Note the production URL — that's `DASHBOARD_URL` (set it in both Vercel and GitHub secrets).

### 3. API keys (all free, ~5 min each)

- **Ticketmaster**: developer.ticketmaster.com → create app → copy the **Consumer Key** (the secret is not needed).
- **CFBD**: collegefootballdata.com → API Keys → key arrives by email.
- **SerpApi**: serpapi.com → sign up → copy the private API key. This is where competitor and parity prices come from. The free plan allows **250 searches/month**, which is the whole reason the collector runs 3×/day instead of 7 — see "Search budget" below. Then set `serpapi.query` and `serpapi.propertyToken` for the property in `config/properties.json`: the query is `hotels near <street address>`, and the token comes from any search response's `properties[].property_token` for your own hotel.

### 4. Resend (email)

1. resend.com → **create the account with the email address that should receive alerts** (see caveat below) → API Keys → create key.
2. ⚠️ **Free-tier caveat:** without a verified domain, Resend only delivers to the account owner's own address, from `onboarding@resend.dev`. That's fine for this use — just create the account with the target address. If you later buy/control a domain: Resend → Domains → verify via DNS, then change `from` in `lib/alerts/email.ts` and set `ALERT_EMAIL_TO` to any list of addresses.

### 5. Site password

`SITE_PASSWORD` is whatever you choose; share it with the family. `SESSION_SECRET`
and `INGEST_SECRET`: generate each with `openssl rand -hex 32`. The site also sets
`robots.txt` disallow + `noindex` headers on every page — it won't appear in search
engines.

## Verifying the pipeline end to end

1. GitHub → Actions → **collect** → Run workflow (manual runs bypass the hour gate).
2. Watch the job log: the collection summary lists each source as ✓ ok / ✗ failed / awaiting-key, then the ingest summary shows nights scored, triggers, email status.
3. Open the dashboard → tonight's recommendation + reasoning should render; the parity panel shows every channel Google Hotels lists for us, our own direct rate first (some may say "needs manual check" — that's a truthful state, not a bug).
4. To test an email: temporarily lower a threshold in `lib/alerts/rules.ts` (e.g. `RATE_DELTA_USD = 0`), push, run the workflow, restore. Or wait — the first real event/holiday/rate move will send one.
5. Local dev: `npm install && npm run dev` (uses `.data/store.json`, no Upstash needed). Collector locally: `npm run collect -- --dry-run --skip-rates`.

## Schedule

3 runs/day Central: 7:00, 13:00, 18:00. GitHub cron is UTC and ignores DST, so the
workflow fires at both possible UTC hours and a data-freshness gate dedupes —
correct in both CST and CDT. GitHub Actions scheduling can drift by a few minutes
at busy times; that's normal, and the gate is drift-immune by design.

Keep these hours in step with `RUN_SLOTS_CT` in `collector/budget.ts` — the
collector decides what to fetch based on which slot it thinks it's in.

## Search budget

Prices are metered. The SerpApi free plan gives 250 searches/month, and the
collector spends them down a fixed ladder rather than fetching everything every run:

| Slot | What it buys | Cost |
|---|---|---|
| 07:00 | tomorrow's compset + our parity/room rates + up to 3 event nights | 5 |
| 13:00 | tomorrow's compset | 1 |
| 18:00 | tomorrow's compset | 1 |

That's ~217/month, leaving a 20-search reserve for on-demand runs. Before every run
the collector reads the live balance and renewal date from SerpApi's free `/account`
endpoint and picks a tier: **full** (7/day), **reduced** (4/day — event nights
paused), or **minimal** (1/day). It degrades instead of erroring, and recovers on
its own as the cycle runs down. Current state is on **Settings → Integrations →
Price search budget**, and an email fires if fewer than 10 searches remain.

One search returns every nearby hotel priced for a night, so the compset costs the
same whether you track 3 competitors or 15. **"Collect now" is throttled to once per
15 minutes** because each press spends real searches.

## Maintenance (the honest list)

- **Holiday table** (`config/holidays.json`): extend once a year (~10 min). CMA Fest dates are estimates until announced — correct them when Nashville publishes dates.
- **Scrapers rot.** University calendar pages change structure roughly yearly. When a source shows "parse failed / structure may have changed" on the dashboard, the selectors in `collector/sources/calendars.ts` need a 15-minute refresh. A broken scrape only skips that source — the rest of the run continues. Prices are no longer scraped at all, so they are not exposed to this.
- **Music City Center** calendar is JavaScript-rendered; the plain fetch may consistently return nothing. If it stays empty, rely on the manual note field for known conventions.
- **Not every hotel is in Google Hotels.** As of 2026-08-23, 8 of the 10 watchlist hotels are carried; Super 8 and Motel 6 are not, on either results page. They show under "not carried" in the budget panel rather than silently reading as $0. No number of searches will find them — either drop them from the watchlist or accept the gap.
- **Compset** (`config/compset.json`): the competitor whitelist is editable — add/remove hotels as the market changes. Names only need to match once; the collector then pins each hotel by its stable `property_token`. Compset is a sanity bound on quiet nights only; event nights are never capped.
- **Parity is Google's view of the market**, which can lag a channel by hours, and it covers ~25 channels including resellers. Expect to see resellers below your direct rate — that is the point of the panel, not a bug in it.
- **Corporate events** at Nissan NA / CHS campuses aren't published anywhere — that's what the dashboard's manual note field is for.
