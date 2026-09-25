# Rate Radar

**Revenue management for independent hotels.** It watches competitor prices, local
events, weather and holidays, then recommends a nightly rate — with the arithmetic
attached, including the signals it decided *not* to act on.

### ▶ [Try the live demo](https://rate-radar-six.vercel.app/demo) — no sign-up, every control live

The demo opens a private sandbox of an invented hotel in an invented town. Edit the
baselines, add competitors, record rates: the numbers really recompute, through the
same engine that prices the real property. Your changes stay in your own sandbox and
clear themselves after a day.

---

## What this actually is

A working system, not a portfolio exercise. It runs twice a day for a real
hotel — the [Red Roof Inn Franklin, TN](https://rate-radar-six.vercel.app) — pulling
from six public data sources and emailing the owner when something merits attention.
The architecture is multi-tenant (property registry, scoped storage keys, per-property
API keys) because a second hotel was always the point, but exactly one property is
live today.

> **It never changes a price anywhere. It recommends — a human decides.**
>
> This is the load-bearing product fact, not a disclaimer. Competitors in revenue
> management sell automation; this sells a defensible opinion and leaves the operator
> holding the decision.

<!-- Screenshots: drop PNGs in docs/screenshots/ and uncomment.
| Dashboard | Reasoning |
|---|---|
| ![Executive overview](docs/screenshots/overview.png) | ![Rate reasoning](docs/screenshots/calendar.png) |
-->

## How it works

```
GitHub Actions (2x/day CT, free)          Vercel (Hobby, free)
┌─────────────────────────────┐          ┌──────────────────────────────┐
│ collector/index.ts           │  POST    │ /api/ingest                  │
│  ├ Ticketmaster (3 venues)   │ ───────► │  ├ score events per night    │
│  ├ CFBD (Vandy football)     │  bundle  │  ├ uplift % → $ per tier     │
│  ├ NWS alerts (2 counties)   │          │  ├ diff vs last-emailed      │
│  ├ FAA (BNA status)          │          │  ├ store snapshot            │
│  ├ Univ/MCC calendars        │          │  └ alert rules → Resend email│
│  └ SerpApi (Google Hotels)   │          │ Dashboard (session-gated)    │
│    compset + parity, metered │          │ Supabase (Postgres + Auth)   │
└─────────────────────────────┘          └──────────────────────────────┘
```

The collector is deliberately dumb: it fetches, tags each source ✓ ok / ✗ failed /
awaiting-key, and POSTs one bundle. All scoring, diffing and alerting happens in one
place on ingest, so there is a single brain to reason about and a stored raw bundle to
recompute from when the owner edits a baseline.

**Scoring is deterministic and inspectable.** Every event gets an overflow-likelihood
score — draw size vs. what downtown Nashville absorbs, × travel-draw, × day-of-week,
compounded with diminishing returns for same-night events. No model, no black box.
Events judged too small to matter are **shown with that verdict** rather than silently
dropped, because a recommendation you can only see the winners of isn't auditable.
Full derivation: [`docs/design/specs/2026-07-12-rate-radar-design.md`](docs/design/specs/2026-07-12-rate-radar-design.md).

## Worth a look, if you're reviewing this

- **[`backend/tests/role-guard.test.ts`](backend/tests/role-guard.test.ts)** — a test that reads the route tree and fails the build if a new mutating endpoint ships without a role check. Routes authenticated by something other than a session are listed by name with the reason. The gap can't quietly reopen.
- **[`backend/collector/budget.ts`](backend/collector/budget.ts)** — prices are metered (250 SerpApi searches/month). Before each run the collector reads its live balance and picks a tier: full, reduced, or minimal. It degrades instead of erroring and recovers on its own.
- **[`.github/workflows/collect.yml`](.github/workflows/collect.yml)** — GitHub's cron is UTC and DST-unaware, and its scheduler drifts. The workflow fires at both candidate UTC hours and gates on *data freshness* rather than wall-clock hour, so it's correct in CST and CDT and immune to drift. It fails open: if the health check is unreachable, it collects rather than silently starving.
- **[`backend/lib/demo/context.ts`](backend/lib/demo/context.ts)** — the public demo is a key-namespaced sandbox in the same Redis, so demo visitors exercise the real route handlers and the real role guard while reaching none of the live property's keys. Endpoints with effects outside the store (metered searches, email) refuse demo callers at their own door.
- **[`backend/lib/scoring/reason.ts`](backend/lib/scoring/reason.ts)** — the reasoning strings the UI shows are generated from the same values that produced the number, so the explanation can't drift from the arithmetic.

## Roles

Three roles, assigned per teammate in **Settings → Team**:

| | viewer | manager | owner |
|---|---|---|---|
| Read dashboard, compset, history, API docs | ✓ | ✓ | ✓ |
| Baseline rates, current rates, watchlist, notes, actuals | | ✓ | ✓ |
| Recompute, on-demand collection run | | ✓ | ✓ |
| Invite/remove teammates | | | ✓ |

Enforcement is **server-side**, in the route handler — `requireRole()` in
[`backend/lib/auth/guard.ts`](backend/lib/auth/guard.ts), one two-line prelude per mutating endpoint.
Being signed in is not permission to write; a viewer's `POST` gets a 403 naming the
role it would need. The UI hides those controls too, but that's courtesy — the check
that matters is the one on the server.

## Run it locally

```bash
npm install && npm run dev
```

No Supabase needed to browse — the store falls back to a local JSON file (`frontend/.data/store.json`),
and every page renders sample data when the store is empty. Visit `/demo` for the
seeded sandbox.

```bash
npm test
```

168 tests across 19 files: scoring, alert rules, parsers against captured HTML
fixtures, auth and role guards, store behaviour, and demo isolation.

```bash
npm run collect -- --dry-run --skip-rates
```

Runs the collector without POSTing and without spending any metered searches.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase Auth (magic link + shared
password) · Supabase Postgres · Vitest · GitHub Actions · Vercel. ~13,400 lines of
TypeScript, 18 API routes.

## Repo layout

| | |
|---|---|
| `frontend/` | the Next.js app: pages, API routes (incl. versioned `/api/v1`), components, public assets. Vercel root directory. |
| `frontend/app/` | dashboard pages + API routes |
| `backend/lib/` | scoring, alerts, ingest, store, auth, demo sandbox |
| `backend/collector/` | GitHub Actions data collection + search budget |
| `backend/config/` | baseline rates, holidays, compset whitelist (user-editable) |
| `backend/tests/` | vitest unit + fixture parser tests |
| `docs/design/` | design specs and implementation plans, including superseded ones |

## Docs

- **[docs/SETUP.md](docs/SETUP.md)** — standing up a live deployment: accounts, secrets, API keys, schedule, search budget, and the honest maintenance list.
- **[PRODUCT.md](PRODUCT.md)** — what the product is for, who it's for, and the constraints future work must preserve.
- **[DESIGN.md](DESIGN.md)** — the "Instrument Panel" design system: tokens, type scale, and the rules the UI is held to.
