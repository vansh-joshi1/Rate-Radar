# Rate Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internal rate-recommendation + rate-parity site for Red Roof Inn Franklin TN (RRI1430): Next.js dashboard on Vercel, GitHub Actions collector, Upstash Redis storage, Resend alerts. Recommendation only — never writes prices anywhere.

**Architecture:** GitHub Actions is a dumb collector (APIs + Playwright scrapes) that POSTs a raw bundle to `/api/ingest`; the ingest handler owns all scoring, diffing, alerting. Deterministic rule-based scoring with transparent per-event reasoning. Store abstraction falls back to a local JSON file when Upstash env vars are absent (demo/dev mode).

**Tech Stack:** Next.js 14 App Router (TypeScript), Upstash Redis REST, Playwright + cheerio in the Action, Resend, Vitest, zod, tsx.

**Spec:** `docs/superpowers/specs/2026-07-12-rate-radar-design.md` — thresholds, scoring constants, and tiers defined there are normative.

---

## File structure

```
rate-radar/
├─ app/
│  ├─ layout.tsx                  root layout, noindex meta
│  ├─ page.tsx                    dashboard (server component, reads store)
│  ├─ login/page.tsx              password form
│  └─ api/
│     ├─ ingest/route.ts          POST bundle → score → diff → store → alert
│     ├─ data/route.ts            GET latest snapshot + history (cookie-gated)
│     ├─ note/route.ts            POST manual note for a date
│     ├─ actual/route.ts          POST actually-charged rate for a date
│     └─ login/route.ts           POST password → set signed cookie
├─ components/                    TodayCard, Outlook, ParityPanel, HistoryLog, NoteBox (client comps)
├─ lib/
│  ├─ store.ts                    KV abstraction: Upstash REST | local file
│  ├─ auth.ts                     HMAC cookie sign/verify
│  ├─ scoring/
│  │  ├─ types.ts                 all shared types
│  │  ├─ venues.ts                venue capacities + travel-draw classifier
│  │  ├─ score.ts                 per-event score, compounding, tiers
│  │  ├─ recommend.ts             night score → uplift → $ per tier + confidence
│  │  └─ reason.ts                plain-language reasoning strings
│  ├─ alerts/
│  │  ├─ rules.ts                 threshold evaluation + fingerprint dedupe
│  │  └─ email.ts                 Resend send, one-email digest body
│  └─ ingest.ts                   orchestration used by api/ingest
├─ config/
│  ├─ rates.json                  baseline rate table (user-editable)
│  └─ holidays.json               US holidays/long weekends 2026–2028
├─ collector/
│  ├─ index.ts                    run all sources → POST to /api/ingest
│  └─ sources/
│     ├─ ticketmaster.ts          Discovery API, 3 venues
│     ├─ cfbd.ts                  Vandy home games
│     ├─ nws.ts                   active alerts Williamson+Davidson
│     ├─ faa.ts                   BNA status XML
│     ├─ calendars.ts             Vandy/Belmont/MCC scrapes (cheerio)
│     └─ rates.ts                 Playwright: redroof/google/expedia/booking
├─ tests/
│  ├─ score.test.ts  recommend.test.ts  rules.test.ts  parsers.test.ts
│  └─ fixtures/                   saved HTML snapshots for parser tests
├─ middleware.ts                  cookie gate (all pages except /login, /api/login, /api/ingest)
├─ public/robots.txt              Disallow: /
├─ .github/workflows/collect.yml  7x/day CT schedule (dual-UTC + hour gate)
├─ .env.example
└─ README.md
```

Every task ends with a commit. Run all tests with `npx vitest run`.

---

### Task 1: Scaffold

**Files:** Create `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx` (placeholder), `public/robots.txt`, `.gitignore`

- [ ] **Step 1: package.json** — deps: `next@14`, `react`, `react-dom`, `zod`, `resend`; devDeps: `typescript`, `@types/react`, `@types/node`, `vitest`, `tsx`, `cheerio`, `playwright` (collector-only deps go in devDependencies; the Action installs everything). Scripts: `dev`, `build`, `start`, `test: vitest run`, `collect: tsx collector/index.ts`.
- [ ] **Step 2: next.config.mjs** — add global `X-Robots-Tag: noindex, nofollow` header:

```js
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
```

- [ ] **Step 3: app/layout.tsx** — `export const metadata = { title: 'Rate Radar', robots: { index: false, follow: false } }`, dark simple styling.
- [ ] **Step 4: public/robots.txt** — `User-agent: *\nDisallow: /`
- [ ] **Step 5: npm install, `npx tsc --noEmit` passes, commit** `chore: scaffold Next.js app with noindex + robots`

### Task 2: Config data

**Files:** Create `config/rates.json`, `config/holidays.json`

- [ ] **Step 1: config/rates.json**

```json
{
  "tiers": [
    { "id": "standard", "label": "Standard (king / double / superior king / handicap)",
      "weekday": { "min": 68, "max": 72 }, "weekend": { "min": 80, "max": 90 } },
    { "id": "queen", "label": "Queen",
      "weekday": { "min": 80, "max": 80 }, "weekend": { "min": 95, "max": 95 } }
  ],
  "upliftCapPct": 40,
  "weekendDays": [5, 6]
}
```

- [ ] **Step 2: config/holidays.json** — entries `{ "date": "YYYY-MM-DD", "name": "...", "span": ["YYYY-MM-DD", ...], "drawProfile": "major"|"meaningful"|"minor" }` for: MLK, Presidents Day, Easter weekend, Memorial Day, Juneteenth, July 4th, Labor Day, Thanksgiving (Wed–Sun span), Christmas (Dec 23–26), New Year's (Dec 30–Jan 1), CMA Fest weekend placeholder note — **2026, 2027, 2028** actual dates. Long-weekend spans include the adjacent Fri/Sat/Sun nights. `drawProfile`: July 4th/Thanksgiving/Christmas/New Year's/Memorial/Labor = `meaningful` (travel corridors, I-65 traffic), MLK/Presidents/Juneteenth = `minor`.
- [ ] **Step 3: Commit** `feat: baseline rate table and 2026-2028 holiday calendar`

### Task 3: Store abstraction

**Files:** Create `lib/store.ts` · Test `tests/store.test.ts`

Interface (memorize — used everywhere):

```ts
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  lpush(key: string, value: unknown): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
}
export function getStore(): Store; // Upstash REST if KV_REST_API_URL+TOKEN set, else FileStore('.data/store.json')
```

- [ ] **Step 1: failing test** — FileStore roundtrips get/set/hget/hset/lpush/lrange with JSON values (use temp dir).
- [ ] **Step 2: run, FAIL** (`getStore not defined`).
- [ ] **Step 3: implement** — Upstash driver via raw `fetch(`${url}/pipeline`)` REST calls (no SDK dep needed: single-command endpoints `GET/SET/HGET/HSET/LPUSH/LRANGE`, values `JSON.stringify`d); FileStore reads/writes one JSON object `{ kv: {}, hashes: {}, lists: {} }` synchronously per op.
- [ ] **Step 4: tests pass.** **Step 5: commit** `feat: store abstraction (Upstash REST / local file)`

### Task 4: Scoring engine (TDD, the heart)

**Files:** Create `lib/scoring/types.ts`, `lib/scoring/venues.ts`, `lib/scoring/score.ts` · Test `tests/score.test.ts`

- [ ] **Step 1: types.ts**

```ts
export type SourceStatus = 'ok' | 'failed' | 'awaiting-key';
export interface RawEvent {
  id: string; name: string; date: string;            // YYYY-MM-DD (night of)
  venue: string; capacity: number | null;             // null → classifier default
  expectedAttendance?: number;                        // overrides capacity heuristic
  kind: 'concert' | 'sports' | 'convention' | 'university' | 'holiday' | 'other';
  isTouring?: boolean; multiNight?: boolean; selloutLikely?: boolean;
  source: string;
}
export interface ScoredEvent extends RawEvent {
  attendanceEstimate: number; baseDraw: number; travelDraw: number;
  dowMultiplier: number; score: number;
  tier: 'too-small' | 'minor' | 'meaningful' | 'major';
  verdict: string;                                    // one plain-language line
}
export interface NightSignal {
  date: string; events: ScoredEvent[]; nightScore: number;
  weatherNote?: string; bnaNote?: string; holidayName?: string;
}
```

- [ ] **Step 2: venues.ts** — capacity map: `nissan stadium: 69000`, `geodis park: 30000`, `bridgestone arena: 17100`, `firstbank stadium: 34000`, `music city center: 5000 (default when unpublished)`; `travelDraw(e: RawEvent): number`: stadium touring concert 1.5; arena touring headliner 1.2; marathon/large convention (≥8k) 1.3; university graduation/move-in 1.4; NHL/MLS regular season 0.6; unknown 0.5; club/local (`capacity < 2500`) 0.3.
- [ ] **Step 3: failing tests** (exact expectations, K=25000, DOW Fri/Sat 1.0, Thu/Sun 0.7, Mon–Wed 0.45):

```ts
// baseDraw = 100 * a/(a+25000)
// stadium sellout Sat touring: a=69000 → base 73.4 * 1.5 * 1.0 → capped 100 → 'major'
// bridgestone touring Tue: a≈13680 (17100*0.8 fill) → base 35.4 * 1.2 * 0.45 = 19.1 → 'minor'
// 300-cap club Sat: base 1.18 * 0.3 * 1.0 = 0.35 → 'too-small', verdict includes 'too small to move demand'
// compounding: two events s=60,s=40 → 100*(1-0.4*0.6)=76, NOT 100
// tiers: <15 too-small, <40 minor, <70 meaningful, else major
```

- [ ] **Step 4: run, FAIL.** **Step 5: implement score.ts**

```ts
const K = 25000;
const DOW = [0.7, 0.45, 0.45, 0.45, 0.7, 1.0, 1.0]; // Sun..Sat
const FILL_DEFAULT = 0.8, FILL_SELLOUT = 1.0;
export function scoreEvent(e: RawEvent): ScoredEvent { /* attendance = expectedAttendance ?? capacity*fill; base = 100*a/(a+K); s = clamp(base*travelDraw(e)*DOW[dow],0,100); tier + verdict from thresholds 15/40/70 */ }
export function nightScore(events: ScoredEvent[]): number {
  return Math.round(100 * (1 - events.reduce((p, e) => p * (1 - e.score / 100), 1)));
}
```

Verdict strings: too-small → `"Nearby, likely too small to move demand in Franklin"`; minor → `"Minor signal — unlikely to justify a rate move on its own"`; meaningful → `"Likely to push some overflow demand toward Franklin"`; major → `"Strong overflow likelihood — downtown will be contested"`.
- [ ] **Step 6: tests pass.** **Step 7: commit** `feat: event scoring engine with overflow model + compounding`

### Task 5: Recommendation engine (TDD)

**Files:** Create `lib/scoring/recommend.ts`, `lib/scoring/reason.ts` · Test `tests/recommend.test.ts`

- [ ] **Step 1: failing tests**

```ts
// upliftPct(0)=0, upliftPct(39)=0, upliftPct(40)=5, upliftPct(100)=40, upliftPct(70)=22.5
// Sat night, score 0, standard tier → rec = weekend {min:80,max:90} → recommended 85, range [80,90]
// Sat night, score 70 → uplift 22.5% → recommended round(85*1.225)=104, range [98,110]
// weekday Tue score 0 standard → recommended 70 [68,72]
// confidence: all sources ok → 100; rates failed(weight .3) → 70; reason text mentions the failed source
```

- [ ] **Step 2: run, FAIL.** **Step 3: implement** — `upliftPct(s) = s<40 ? 0 : 5 + (s-40)/60*35`; per tier: base = weekday|weekend by DOW (weekendDays from rates.json; Fri+Sat), recommended = round(mid(base)*(1+u/100)), range = [round(min*(1+u/100)), round(max*(1+u/100))], capped at `upliftCapPct`. Confidence = `round(100 * Σ(weight_i × ok_i))` with weights: rates .3, ticketmaster .25, cfbd .1, nws .1, faa .05, calendars .15, holidays .05 (static, always ok). `reason.ts` builds ordered paragraphs: night drivers (each event verdict + score), weather note, BNA note, holiday, then confidence cause.
- [ ] **Step 4: tests pass.** **Step 5: commit** `feat: uplift mapping, per-tier recommendation, confidence + reasoning`

### Task 6: Alert rules (TDD)

**Files:** Create `lib/alerts/rules.ts` · Test `tests/rules.test.ts`

- [ ] **Step 1: failing tests** (thresholds from spec):

```ts
// rateChange: prevEmailed 85 → new 89 (Δ$4, 4.7%) no alert; → 90 (Δ$5) alert; → 92 (8.2%) alert
// parityGap: [72, 74, 79] spread $7/9.7% → no; [70, 79] spread $9/12.9% → yes
// newEvent: score 40 first-seen → alert; score 39 → no; seen-before id → no
// weather: severity 'Severe' → alert; 'Moderate' → no
// holiday within 14 days unflagged → alert; already-fingerprinted → no
// dedupe: same fingerprint within 24h suppressed; value re-crossing threshold → alert again
// multiple triggers → single digest with all lines
```

- [ ] **Step 2: run, FAIL.** **Step 3: implement** — pure function `evaluateAlerts(input: {nights, parity, weatherAlerts, prevEmailed, fingerprints, now}): { triggers: Trigger[], newFingerprints, newEmailedState }`; `Trigger = { type, date?, line }` where `line` is the final email sentence (e.g. `"Sat Jul 18: recommended $104 (was $85) — Morgan Wallen at Nissan Stadium, strong overflow likelihood."`). Fingerprint = `${type}:${subject}:${bucket}` with value bucketing ($5 buckets for rates, $4 for parity).
- [ ] **Step 4: tests pass.** **Step 5: commit** `feat: alert threshold engine with fingerprint dedupe`

### Task 7: Email

**Files:** Create `lib/alerts/email.ts`

- [ ] **Step 1: implement** (no test — thin I/O wrapper): `sendAlertEmail(triggers: Trigger[])` → Resend SDK, from `Rate Radar <onboarding@resend.dev>`, to `ALERT_EMAIL_TO` (comma-split), subject `Rate Radar: N update(s) — <first date>`, plain-text body = one line per trigger + `Full reasoning: ${DASHBOARD_URL}`. Skips silently with console.warn if `RESEND_API_KEY` unset.
- [ ] **Step 2: `npx tsc --noEmit`, commit** `feat: Resend alert email (single digest)`

### Task 8: Ingest orchestration + API route

**Files:** Create `lib/ingest.ts`, `app/api/ingest/route.ts`

Bundle shape (zod-validated; what the collector POSTs):

```ts
const SourceResult = z.object({ source: z.string(), status: z.enum(['ok','failed','awaiting-key']),
  error: z.string().optional(), fetchedAt: z.string(), data: z.unknown().optional() });
const Bundle = z.object({ runAt: z.string(), sources: z.array(SourceResult) });
```

- [ ] **Step 1: lib/ingest.ts** — `processBundle(bundle, store)`: merge raw events from ticketmaster/cfbd/calendars + holiday pseudo-events for the 22-night window (today..+21, America/Chicago); score each night; apply weather/BNA modifiers (notes + confidence penalty, winter-storm same-night flag); build recommendations per night per tier; assemble snapshot `{ runAt, nights, parity, sources, confidence }`; load `emailed:state` + `alert:fingerprints` + `events:seen` from store; `evaluateAlerts`; persist snapshot (`snapshot:latest`, `snapshot:{date}:{runId}` TTL 30d), append day-final record to `history` (replace same-date head), save fingerprints/emailed-state/events-seen; if triggers → `sendAlertEmail`; return `{ nights: n, triggers: t.length, failedSources: [...] }`.
- [ ] **Step 2: route.ts** — reject unless `Authorization === 'Bearer ' + process.env.INGEST_SECRET`; parse+validate; call `processBundle`; return summary JSON. 401/400/500 paths explicit.
- [ ] **Step 3: `npx tsc --noEmit`, commit** `feat: ingest pipeline (score, diff, store, alert)`

### Task 9: Auth + remaining API routes

**Files:** Create `lib/auth.ts`, `middleware.ts`, `app/login/page.tsx`, `app/api/login/route.ts`, `app/api/data/route.ts`, `app/api/note/route.ts`, `app/api/actual/route.ts`

- [ ] **Step 1: lib/auth.ts** — `sign(value)` = HMAC-SHA256(`SESSION_SECRET`) hex; cookie `rr_session=v.sig`; `verify(cookie)` constant-time compare. Web Crypto API (edge-safe), not node:crypto.
- [ ] **Step 2: middleware.ts** — matcher everything except `/_next`, `/login`, `/api/login`, `/api/ingest`, `/robots.txt`; no valid cookie → redirect `/login` (pages) or 401 JSON (api).
- [ ] **Step 3: login** — page posts password to `/api/login`; route compares to `SITE_PASSWORD`, sets httpOnly secure cookie (1 year), redirects `/`.
- [ ] **Step 4: data/note/actual routes** — `GET /api/data` returns `{ snapshot, history, note, actuals }`; `POST /api/note { date, text }`; `POST /api/actual { date, tierId, rate }` (zod-validated, store-backed).
- [ ] **Step 5: `npx tsc --noEmit`, commit** `feat: password gate + data/note/actual endpoints`

### Task 10: Dashboard UI

**Files:** Create `components/TodayCard.tsx`, `components/Outlook.tsx`, `components/ParityPanel.tsx`, `components/HistoryLog.tsx`, `components/NoteBox.tsx`; Modify `app/page.tsx`

- [ ] **Step 1: page.tsx** (server component) — reads store directly (same helpers as /api/data), renders the five sections; shows `runAt` age banner if stale >6h.
- [ ] **Step 2: TodayCard** — per-tier recommended $ + range, confidence bar, reasoning list: every event with score, tier badge, verdict (too-small events visible, struck-muted style), weather/BNA/holiday notes.
- [ ] **Step 3: Outlook** — 21 rows: date, night score chip (gray <15 / blue <40 / amber <70 / red ≥70), uplift %, per-tier $, top driver text or "no demand signal".
- [ ] **Step 4: ParityPanel** — 4 columns (redroof / google / expedia / booking): price or `needs manual check` + error hint + fetchedAt; gap badge when spread ≥ $8 or ≥10%.
- [ ] **Step 5: HistoryLog** — table of history records vs `actual:{date}` values; inline form posting to `/api/actual`. **NoteBox** — textarea posting to `/api/note`, shown on TodayCard.
- [ ] **Step 6: `npm run build` passes, commit** `feat: dashboard (today, outlook, parity, history, note)`

### Task 11: Collectors — APIs

**Files:** Create `collector/sources/ticketmaster.ts`, `cfbd.ts`, `nws.ts`, `faa.ts`

Each exports `collect(): Promise<SourceResult>` and NEVER throws (catch → `status:'failed'`, missing key → `'awaiting-key'`).

- [ ] **Step 1: ticketmaster.ts** — Discovery `GET /discovery/v2/events?apikey=...&venueId=` for Bridgestone (`KovZpZAEkn6A`—resolve real IDs at runtime via venue search by name once, cache in module) — simpler: query by `latlong=36.16,-86.77&radius=10&unit=miles&size=100&startDateTime/endDateTime` for the 22-night window, then filter to the 3 venue names. Map → `RawEvent` (capacity from venues.ts map, `isTouring` = classification segment Music + touring attraction, `multiNight` = same attraction+venue on consecutive dates in results, `selloutLikely` = multiNight || stadium headliner).
- [ ] **Step 2: cfbd.ts** — `GET https://api.collegefootballdata.com/games?year=&team=Vanderbilt&seasonType=regular` header `Authorization: Bearer ${CFBD_API_KEY}`; home games only → RawEvent kind sports, venue FirstBank Stadium, capacity 34000, travel profile via kind.
- [ ] **Step 3: nws.ts** — `GET https://api.weather.gov/alerts/active?zone=TNZ027` + Davidson `TNZ026` (VERIFY zone codes at implementation time via `/points/35.9253,-86.8689` and `/points/36.16,-86.78`), header `User-Agent: ${NWS_USER_AGENT}`; map severity/event/headline; classify winter events (`Winter Storm`, `Ice Storm`, `Blizzard`) with `possibleStrandedDemand: true`.
- [ ] **Step 4: faa.ts** — fetch XML, regex/parse `<Airport>` blocks for `BNA` ground stops/delays (no XML dep; the format is stable flat XML). Result `{ bnaDisrupted: boolean, detail }`.
- [ ] **Step 5: `npx tsc --noEmit`, commit** `feat: API collectors (ticketmaster, cfbd, nws, faa)`

### Task 12: Collectors — calendar scrapes (fixture TDD)

**Files:** Create `collector/sources/calendars.ts` · Test `tests/parsers.test.ts` + `tests/fixtures/{vandy,belmont,mcc}.html`

- [ ] **Step 1: fetch real pages once** (registrar.vanderbilt.edu academic calendar, belmont.edu academic calendar, nashvillemusiccitycenter.com events) — save trimmed HTML to fixtures. If a page is unreachable from the dev environment, construct fixture from its live DOM via browser tooling.
- [ ] **Step 2: failing parser tests** — each parser given its fixture returns ≥1 event with correct shape; given `<html><body>changed</body></html>` returns `[]` and a warning string (not a throw).
- [ ] **Step 3: implement** — cheerio parsers keyed on the most stable selectors available (table rows / event cards); keyword filter to overnight-relevant items only: commencement/graduation, move-in, family/parents weekend (universities); MCC events kept when name suggests multi-day convention/expo (default attendance 5000, `expectedAttendance` parsed if listed). Each parser wrapped: failure → `{ status:'failed', error }` + `console.warn('[calendars] <source> parse failed — page structure may have changed: <url>')`.
- [ ] **Step 4: tests pass, commit** `feat: university + convention center calendar scrapers with fixture tests`

### Task 13: Collectors — rate parity (Playwright)

**Files:** Create `collector/sources/rates.ts`

- [ ] **Step 1: implement** four independent checkers, each `try/catch → needs-manual-check`:
  - **redroof**: try JSON first — the checkout page calls a rates XHR; intercept via Playwright `page.waitForResponse(/rate|room|avail/i)`; fallback: DOM price selector. URL from `RATE_URL_REDROOF` with dates rewritten to tomorrow/+1.
  - **google**: `https://www.google.com/travel/search?q=Red%20Roof%20Inn%20Franklin%20TN` , click through to property card, read nightly price (headless Chromium, en-US locale, consent-dialog dismissal).
  - **expedia / booking**: user URLs with `chkin/checkin` params rewritten; price = first visible room-card price (selectors as constants at top of file for easy maintenance).
  - All: 30s timeout each, `blockResources(['image','font','media'])` for speed, price normalization strips `$`, commas, "per night".
- [ ] **Step 2: manual spot-run** `tsx -e` against redroof only to sanity-check locally if network permits; otherwise verified in Action.
- [ ] **Step 3: commit** `feat: rate parity checkers (4 sources, isolated failures)`

### Task 14: Collector runner + GitHub Actions workflow

**Files:** Create `collector/index.ts`, `.github/workflows/collect.yml`

- [ ] **Step 1: index.ts** — `Promise.allSettled` over all collectors; assemble Bundle; `--dry-run` flag prints bundle instead of POSTing; else POST `${DASHBOARD_URL}/api/ingest` with bearer `INGEST_SECRET`; print per-source status table + ingest summary; exit 1 only if ALL sources failed or ingest rejected.
- [ ] **Step 2: collect.yml**

```yaml
name: collect
on:
  schedule:
    # CT targets 7,10,13,15,18,20,22 → both CDT(UTC-5) and CST(UTC-6) candidates; job gates on real CT hour
    - cron: '7 12,13,15,16,18,19,20,21,23 * * *'
    - cron: '7 0,1,2,3,4 * * *'
  workflow_dispatch: {}
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - id: gate
        run: |
          H=$(TZ=America/Chicago date +%-H)
          case "$H" in 7|10|13|15|18|20|22) echo "run=yes" >> $GITHUB_OUTPUT;; *) echo "run=no" >> $GITHUB_OUTPUT;; esac
      - if: steps.gate.outputs.run == 'yes' || github.event_name == 'workflow_dispatch'
        uses: actions/checkout@v4
      # … setup-node@v4 (node 20, npm cache), npm ci, npx playwright install --with-deps chromium,
      # npm run collect with env: TICKETMASTER_API_KEY, CFBD_API_KEY, NWS_USER_AGENT, DASHBOARD_URL,
      # INGEST_SECRET, RATE_URL_* from secrets — every step after gate carries the same `if:`
```

- [ ] **Step 3: verify cron hour math** (CT7=12/13UTC, CT10=15/16, CT13=18/19, CT15=20/21, CT18=23/0, CT20=1/2, CT22=3/4) — union = `12,13,15,16,18,19,20,21,23` + `0,1,2,3,4`. Commit `feat: collector runner + 7x/day CT workflow (DST-safe)`

### Task 15: .env.example + README

**Files:** Create `.env.example`, `README.md`

- [ ] **Step 1: .env.example** — every var with a comment: what it is, where to get it (developer.ticketmaster.com; collegefootballdata.com; Vercel Marketplace → Upstash for KV_REST_API_URL/TOKEN; resend.com API key; generated secrets via `openssl rand -hex 32`; NWS_USER_AGENT format `AppName (contact email)`; the four property URLs prefilled with the user's real URLs).
- [ ] **Step 2: README.md** — sections: What this is (+ what it never does); Architecture diagram (ascii); Account setup under business identity (GitHub org/account, Vercel, Resend — note free-tier Resend without domain delivers only to account owner; how to verify a domain later and flip ALERT_EMAIL_TO); Getting each API key; Vercel deploy + Marketplace Upstash setup; GitHub secrets list; setting SITE_PASSWORD; how the DST-safe schedule works; end-to-end verification checklist (`workflow_dispatch` run → Action summary → dashboard shows snapshot → test email); maintenance notes (holiday table annual refresh, scraper selector maintenance, rebrand note about Days Inn URL slugs).
- [ ] **Step 3: commit** `docs: env reference + full setup README`

### Task 16: End-to-end demo run

- [ ] **Step 1:** `npx vitest run` — all green; `npm run build` — clean.
- [ ] **Step 2:** Gather today's REAL data: run API collectors where network allows; where the sandbox blocks direct egress, fetch via available browser/fetch tooling and inject as collector fixtures (clearly labeled per-source how it was obtained).
- [ ] **Step 3:** `npm run collect -- --dry-run` variant wired to local ingest (`processBundle` against FileStore) → produce today's snapshot; render dashboard locally (`npm run dev`) and screenshot/report.
- [ ] **Step 4:** Present: per-source status table (ok / failed+why / awaiting-key), today's recommendation per tier with reasoning, parity panel state, whether an email would have fired and why/why not.
- [ ] **Step 5:** commit `chore: demo run artifacts` (fixtures only — never .env)

---

## Self-review (done at write time)

- **Spec coverage:** every spec section maps to a task — scoring (T4), uplift/confidence (T5), thresholds/dedupe (T6), email (T7), ingest/data-flow (T8), auth/privacy (T9), dashboard incl. too-small visibility + manual note + history (T10), API collectors (T11), calendar scrapes w/ warn-and-skip (T12), 4-source parity (T13), DST-safe 7x CT schedule (T14), env/README incl. Resend caveat + business-account note (T15), run-once deliverable (T16). ✓
- **Placeholder scan:** none — constants, thresholds, selectors strategy, cron unions all pinned. Venue IDs intentionally resolved at runtime by name (more robust than hardcoded IDs). ✓
- **Type consistency:** `SourceResult`/`Bundle` (T8) match collector outputs (T11–14); `RawEvent`/`ScoredEvent`/`NightSignal` (T4) consumed by T5/T8/T10; `Store` interface (T3) used in T8/T9/T10. ✓

