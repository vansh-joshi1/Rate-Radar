# Compset Transport Hardening

**Status:** approved design, not yet implemented
**Date:** 2026-08-16
**Phase:** 1 of 2 — transport only. The price-engine rebuild is Phase 2.
**Touches:** `collector/sources/rates.ts`, `.github/workflows/collect.yml`, `lib/ingest.ts`, `components/SettingsView.tsx`

## Why

The compset pipeline "is not always getting the prices." The misses have two
unrelated causes, and this phase addresses only the first — deliberately, so the
second can be diagnosed with evidence rather than assumption.

**Cause 1 — the transport is transparently automated.** Detection is layered, and
`rates.ts` only answers the outermost layer:

| Layer | Signal | Current state |
|---|---|---|
| IP reputation | GitHub-hosted runners use published Azure datacenter ranges, and the IPs rotate daily so no reputation accrues | Fully exposed |
| Browser fingerprint | `navigator.webdriver`, CDP `Runtime.enable` leak, GPU renderer, plugin list, screen metrics | Only `navigator.webdriver` patched — a 2020-era mitigation |
| Behaviour / session | Interaction timing, session continuity, TLS handshake shape | Not addressed; every attempt presents as a first-ever visitor with no cookie history |

Booking.com runs Akamai Bot Manager, which challenges within a few requests from
datacenter IPs. Google Hotels is softer but degrades differently: under suspicion it
serves a default-date carousel, which is what the existing honesty guard in
`rates.ts:564-568` keeps catching and discarding. The guard is correct — it is a
symptom, not the disease.

**Cause 2 — plain bugs and structural limits, unrelated to blocking.**
`MAX_RESOLVES_PER_RUN = 3` means a ten-hotel watchlist needs four clean runs before it
is even fully addressable, and hotels that fail resolution retry forever at three per
run. Direct checks run for **tomorrow only** (`rates.ts:533`), so every other date
depends on the fragile harvest. `extractPrice`'s last-resort whole-body scan
(`rates.ts:106-111`) can return any `$NN` on the page. These are Phase 2.

**The measurement problem.** Today a bot-walled check, a hotel that never resolved a
URL, and a hotel with genuinely no availability are indistinguishable — all three
produce a missing entry and at most a `console.warn` that vanishes with the Actions
log. There is no way to answer "how much of this is blocking?" That question decides
the entire shape of Phase 2, so this phase answers it first.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Data source | Stay self-hosted — no third-party price API | Owner's explicit constraint: no dependency that can be shut down or repriced |
| Browser | `patchright` (npm), replacing stock `playwright` in the collector | Open source, actively maintained, drop-in; patches leaks at browser level rather than by JS injection |
| Runner | Self-hosted on the owner's Windows 11 laptop, GitHub-hosted as fallback | Residential IP is the single highest-leverage change; laptop-first defers hardware spend until the approach is proven |
| Fallback mechanism | Existing `/api/health` freshness gate, second job scheduled +45 min | Already built and proven in `collect.yml`; needs no new machinery |
| Schedule | 4 runs/day CT — 07:00, 12:00, 15:00, 17:00 (down from 7) | Lower volume is itself less detectable, and frees per-run budget for Phase 2's wider coverage |
| Browser profile | One persistent profile, reused across runs, rotated on repeated blocks | A returning visitor with cookie history reads as human; incognito-every-time does not |
| Sequencing | Telemetry ships first, baselines 3-5 days, **then** transport swaps | "Did it help?" is only answerable against a baseline |
| Telemetry surface | Panel in Settings | Where pipeline status already lives after `6cdf83b` |
| CAPTCHA solving | **Excluded** | Defeating a human-presence challenge is out of scope; also the most brittle and most ban-prone option |

### Rejected alternatives

**A commercial hotel-price API (SerpApi, Amadeus, RapidAPI endpoints).** Near-total
reliability, structured data, no bot walls, and it would return our hotel and nearby
properties in one call. Rejected on the owner's constraint: a third party can shut
down, reprice, or revoke access, and the whole pipeline would die with it.

**Residential proxy service (Bright Data, Oxylabs, Evomi).** The standard answer to
datacenter-IP blocking, and cheaper than a price API. Rejected for the same reason —
it reintroduces exactly the third-party dependency the owner ruled out, and a
self-hosted runner on a real residential connection achieves the same effect for the
cost of hardware already owned.

**Camoufox instead of Patchright.** Benchmarks slightly better (C++-level patches to a
Firefox fork versus Patchright's pre-launch Chromium patches). Rejected because it is
Python-first and this collector is TypeScript; `patchright` npm is a genuine drop-in
against the existing Playwright API surface. `rebrowser-patches` was also considered
and rejected — last commit September 2024, effectively abandoned.

**Skipping the baseline and shipping everything at once.** Faster to a fix. Rejected
because the stated purpose of choosing transport-first was to learn how much is
blocking before committing to a rebuild, and post-change numbers with nothing to
compare against do not support that decision.

**Buying a mini PC up front.** Rejected as committing before evidence. The chosen run
times (07:00-17:00 CT) all fall inside the working day, so a laptop that is open
during business hours genuinely covers them.

## Scope

**In:** structured per-attempt telemetry; Patchright swap and the stealth cleanup it
requires; persistent browser profile with rotation; self-hosted runner plus fallback
leg; schedule reduction to 4 runs/day; a collection-health panel in Settings.

**Out (Phase 2):** the source-adapter interface; per-source identity registry
replacing `MAX_RESOLVES_PER_RUN`; brand-direct adapters (Choice, IHG, Wyndham, G6,
Hilton); Expedia and Booking as a parity layer; our own hotel as row 0 of the same
grid; date coverage beyond tomorrow; the `extractPrice` tightening.

## Design

### 1. Telemetry

Every price attempt emits one record instead of a `console.warn`:

```ts
interface AttemptRecord {
  target: 'ours' | string;        // hotel name for competitors
  source: 'redroof' | 'google' | 'expedia' | 'booking' | 'booking-direct';
  date: string;                   // YYYY-MM-DD
  outcome: 'ok' | 'blocked' | 'no-price' | 'timeout'
         | 'unresolved' | 'sanity-rejected' | 'error';
  attempts: number;
  durationMs: number;
}
```

The `outcome` values are chosen to separate what is currently conflated. `blocked` is
set when `botWalled()` matches — that detector already exists at `rates.ts:70-72` and
is simply not recorded anywhere today. `unresolved` covers a hotel with no Booking URL
and no resolution attempt left this run, which is presently silent.

Run-level context wraps the records:

```ts
interface RunTelemetry {
  runAt: string;
  runLeg: 'self-hosted' | 'github-hosted';   // from RUN_LEG env var
  browser: 'playwright' | 'patchright';      // so baseline and post-swap runs are distinguishable
  profileAgeRuns: number;                    // 0 on a fresh/rotated profile
  attempts: AttemptRecord[];
}
```

`runLeg` and `browser` are what make the comparison possible: residential-versus-
datacenter and patched-versus-stock become filterable dimensions rather than
before/after guesswork.

The bundle carries this as `SourceResult.data.telemetry` for `source: 'rates'`. Ingest
appends it to a rolling window of the last 100 runs under
`prop:{id}:collection-telemetry` — bounded, so Upstash's free tier is unaffected.

### 2. Patchright swap

`npm i patchright`, then `import { chromium } from 'patchright'` in place of the
dynamic `playwright` import at `rates.ts:523`.

Three existing countermeasures become liabilities and must be **removed**, not kept
alongside:

| Remove | Location | Why |
|---|---|---|
| `navigator.webdriver` init script | `rates.ts:57-59` | Patchright patches at browser level; a redundant JS override is itself a detectable leak |
| Custom `userAgent` | `rates.ts:49-51` | Patchright docs are explicit — do not set one; a UA disagreeing with the real build is a strong tell |
| `extraHTTPHeaders: Accept-Language` | `rates.ts:52` | Same rule: no custom headers |
| `--disable-blink-features=AutomationControlled` | `rates.ts:524` | Patchright adds this itself |

`newPage()` is rewritten around the documented configuration:

```ts
chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: false,
  viewport: null,
  args: ['--window-position=-2400,-2400'],
})
```

**Off-screen positioning** is the answer to `headless: false` on a daily-driver
laptop. Without it a Chrome window steals focus four times a day during the working
day. The window is genuinely headful — which is the point — just not where the owner
is looking. Chrome's `--headless=new` was considered and rejected: it is more
detectable than headful, defeating the purpose.

**Persistent profile, and the tension it resolves.** The current code opens a fresh
context per attempt on the reasoning that "blocks are often per-session"
(`rates.ts:129`). That is true, but it means every attempt presents as a brand-new
incognito visitor with no history — which is itself a signal. This design inverts it:
one profile directory, reused across runs, accumulating ordinary cookie history.
Retry becomes a new page in the same context with a longer backoff, not a new context.

The escape hatch matters, because a persistent profile can be persistently poisoned:
**three consecutive runs where a source's every attempt is `blocked` rotates the
profile directory.** `profileAgeRuns` in the telemetry makes rotations visible, so a
profile that rotates constantly is diagnosable rather than silently thrashing.

This is also where the two changes compound: **a persistent profile is only actually
persistent on a self-hosted runner.** GitHub-hosted gives a fresh VM every run, so the
fallback leg always starts cold and will be more block-prone. That is expected and
acceptable for a fallback, and `runLeg` in the telemetry will show it clearly.

**Consequences to accept.** Patchright disables the Console API entirely, so
`page.on('console')` will never work in this collector. It is unused today, but this
is a permanent debugging constraint and belongs in the maintenance notes. `page.evaluate`
still works (isolated execution contexts by default), so `settlePage` is unaffected.
The `page.on('response')` handler in `checkRedroof` (`rates.ts:236`) uses the Network
domain, not Console, and is also unaffected — to be confirmed at implementation.

The `page.route` handler blocking images, fonts and media (`rates.ts:60-64`) is
**removed**. Real browsers load images, and at 4 runs/day the bandwidth saving no
longer justifies the behavioural tell.

### 3. Workflow

`collect.yml` becomes two jobs sharing `concurrency: { group: collect }`.

**`collect-primary`** — `runs-on: [self-hosted, windows]`, crons at the four CT target
times using the existing both-UTC-candidates pattern. On a self-hosted runner the
workspace persists, so `npm ci` runs only when `package-lock.json` has changed, and
`npx patchright install chrome` is a one-time setup step rather than a per-run cost.
Sets `RUN_LEG=self-hosted`.

**`collect-fallback`** — `runs-on: ubuntu-latest`, same crons offset +45 minutes,
existing freshness gate unchanged. Sets `RUN_LEG=github-hosted`.

The fallback needs no new logic because the freshness gate already implements it: if
the primary ran, data is ~0.75h old, under the 1.25h threshold, and the fallback skips
itself. If the laptop was closed, data is stale and the fallback collects.

**The queued-job hazard, already handled.** A job targeting an offline self-hosted
runner does not fail — it queues. A laptop closed for a week would accumulate queued
runs that all fire at once on reconnect, precisely the volume spike this phase is
trying to avoid. Because the freshness gate is step one of the job, the first queued
run collects and the rest skip themselves. `concurrency` serializes them so the gate
is evaluated after the previous run has landed its data, not concurrently with it.

The `health-watchdog` workflow and the `/api/cron/heartbeat` third leg are unchanged.

### 4. Settings panel

A collection-health section in `SettingsView.tsx`, alongside the integration health
added in `6cdf83b`:

- Coverage for the latest run — "27 of 33 attempts returned a price"
- Outcome breakdown per source, so `blocked` is visibly distinct from `no-price`
- Block rate over the retained window, split by `runLeg` and `browser` — the panel
  that answers this phase's question
- Last rotation of the browser profile, and current `profileAgeRuns`

Read-only. Any role that can see Settings can see it; no new permissions.

## Rollout

1. **Telemetry only.** Ship against the current stack — stock Playwright,
   GitHub-hosted, existing 7-run schedule. No behaviour change.
2. **Baseline, 3-5 days.** Passive. Roughly 21-35 runs of evidence.
3. **Transport swap.** Patchright, persistent profile, self-hosted primary plus
   fallback, schedule down to 4/day. One deploy plus a one-time runner install.
4. **Compare, 3-5 days.** Same panel, `browser` and `runLeg` filters do the work.
5. **Decide Phase 2** on the measured block rate rather than on assumption.

Step 3 is the only one requiring manual setup: installing the Actions runner as an
auto-starting Windows service. Windows Update rebooting the laptop is the most likely
silent failure, and auto-start is what survives it.

## Testing

The scraper itself resists unit testing — it depends on live third-party HTML, which
is why the existing suite tests the pure parsers (`parseRedroofRooms`,
`harvestCompset`, `bookingSlugMatchesName`) and not the fetching. This phase keeps
that boundary.

- **Pure, unit-tested:** the outcome classifier (given an error/result pair, which
  `outcome` is it?), the rotation trigger (given N runs of telemetry, rotate or not?),
  and the telemetry window bound (never exceeds 100 entries).
- **Regression:** existing parser tests must pass unchanged — this phase changes how
  pages are fetched, never how they are parsed.
- **`tests/role-guard.test.ts`** already fails the build if a mutating route ships
  without a role check. The telemetry write goes through `/api/ingest`, which is
  `INGEST_SECRET`-authenticated and already listed there by name; no new route.
- **Manual, step 3:** one `workflow_dispatch` on the self-hosted runner, confirming
  Chrome launches off-screen, the profile directory is created and reused on a second
  run, and telemetry arrives with `runLeg: 'self-hosted'`.

## Risks

**The laptop's IP gets flagged.** Lower volume and a real residential connection make
this unlikely, but if it happens the consequence lands on the owner's home browsing,
not just the collector. The fallback leg keeps data flowing meanwhile. This is the
main argument for the owner's home connection over the hotel's — a flagged hotel IP
would affect staff using booking sites from the property.

**Patchright breaks on a Playwright update.** The project's own README notes fixes can
take a few days. The collector pins the version; the fallback leg can temporarily
revert to stock Playwright since it is cold-profile anyway.

**Transport hardening turns out not to help much.** A real possible outcome, and the
reason this phase exists in this form. If the baseline shows most misses are
`unresolved` and `no-price` rather than `blocked`, then Phase 2's engine work is the
whole answer and the runner can go back to GitHub-hosted. That is a successful result,
not a wasted phase.

**Scope discipline.** The Phase 2 bugs are visible and tempting to fix in passing.
Fixing them mid-baseline contaminates the measurement. They wait.

## Phase 2 preview

Not designed here, recorded so the sequencing is legible. A source-adapter interface
`(hotel, date) → { price, rooms?, status }`; a per-source identity registry replacing
`MAX_RESOLVES_PER_RUN`; brand-direct adapters covering the ten competitors through
five brand systems (Choice, IHG, Wyndham, G6, Hilton); Booking and Expedia demoted to
a parity layer; our own hotel as row 0 of the same grid, which deletes the separate
parity code path; and a run budget scheduler so priority dates are covered every run
while the rest round-robin.
