# Accounts, Property Registry, and Real Onboarding

**Status:** approved design, not yet implemented
**Date:** 2026-08-15
**Supersedes:** the single-property assumptions in `lib/properties.ts` and `config/properties.json`

## Why

Rate Radar is becoming a multi-tenant product: strangers sign up, onboard their own
hotel, and eventually pay. The code is not ready for a second customer, in two ways
that matter.

**Four registries disagree about what a property is.**

1. `lib/properties.ts` — a hardcoded one-element array carrying identity (id, name,
   city, timezone, lat/lng)
2. `config/properties.json` — collector config (rate URLs, compset, room-tier map),
   with values resolved from GitHub secrets at collect time
3. `components/shell/AppShell.tsx` — its own array for the property switcher,
   listing a "Sunrise Suites — Cookeville, TN (demo)" that exists nowhere else
4. The store keys themselves — half property-scoped, half not

Adding a hotel today means editing code in three places and redeploying.

**Seven store keys collide across properties.** `history`, `history:dates`, `notes`,
`actuals`, `emailed:state`, `alert:fingerprints`, and `events:seen` are written
unscoped in `lib/ingest.ts`. A second property does not merely display wrong — it
overwrites the first hotel's history and notes, and shares its alert-dedupe
fingerprints, so real alerts get silently suppressed as duplicates. This is a
data-loss bug, not untidiness.

Separately, the shared site-password login (`auth.config.ts`) returns a single global
identity — `id: 'shared-owner'`, `email: null`, `role: 'owner'` — belonging to no
account. The moment a second customer exists, anyone holding `SITE_PASSWORD` is an
owner in a system containing someone else's hotel.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| End state | Multi-tenant product | Signup, billing, invites and the keyed v1 API already point here |
| Ownership | An **account** owns one or more properties, with one member list | Matches hotel groups and gives billing something to attach to |
| Isolation | Repository layer over scoped keys | Confines key construction to one reviewable module; enforced structurally by tests |
| Migration | Best-effort; history and actuals may reset | Existing data is early and re-collectible |
| Site password | **Deleted** — magic link only | One identity model; every session maps to a real person |
| Signup | Gated by single-use signup codes | Controls arrival while email delivery and scraping capacity are fragile |

### Rejected alternatives

**Flat keys plus an ownership index.** Cheapest migration, since existing `prop:{id}:`
keys already have the right shape. Rejected because tenant isolation would be
discipline rather than structure — the same failure mode as roles being enforced only
by convention, one layer down.

**Account-scoped store wrapper** (`storeFor(accountId)` prefixing every operation).
Strongest guarantee: code physically cannot reach another tenant's data. Rejected
because the collector and any portfolio view need an escape hatch, and the guarantee
is then only as good as its usage.

## Scope

**In:** the account and property model, scoped keys, registry unification, migration
of the live Franklin data, account-aware auth and session, signup by code, and
`/onboarding` as a real write path.

**Out — its own later cycle:** collector multi-tenancy. Per-property scrape config
currently resolves from GitHub secrets (`env:RATE_URL_REDROOF`), which cannot work for
a customer's hotel. Config must move to the store and the runner must loop properties.
Depends on this model; independent of onboarding.

**Consequence of that seam:** a property created through onboarding has no collector
data and will not until that cycle lands. This is surfaced honestly (see Failure
states) rather than hidden behind zeros or sample data.

## Data model

```ts
interface Account  { id: string; name: string; createdAt: string }
interface Member   { email: string; role: Role; invitedAt: string }
interface Property {
  id: string;          // slug, unique within the account
  accountId: string;
  name: string;
  city: string;
  timezone: string;
  lat: number;
  lng: number;
  createdAt: string;
  listings: Listings;
}
interface Listings { direct?: string; expedia?: string; booking?: string; googleHotelsQuery?: string }
```

Account ids are `acct_` + 12 hex characters. `Role` is unchanged, from
`lib/auth/roles.ts`.

`listings` is written by onboarding now and read by the collector in the later cycle.
Persisting it now is what makes onboarding a real write path rather than another
mockup.

`Account` carries **no `plan` field**. Billing is a mock; a plan field would assert
something untrue.

## Key layout

| Scope | Keys |
|---|---|
| Global | `apikeys` · `auth:vt:*` · `rl:*` · `email:{addr}` → accountId · `signup:{code}` · `signup:pending:{email}` |
| Account | `acct:{a}:meta` · `acct:{a}:members` · `acct:{a}:props` |
| Property | `acct:{a}:prop:{p}:` + `meta`, `snapshot:latest`, `snapshot:{date}:{runId}`, `bundle:latest`, `rates-config`, `current-rates`, `watchlist`, `history`, `history:dates`, `notes`, `actuals`, `emailed:state`, `alert:fingerprints`, `events:seen`, `source-health` |

`email:{addr}` maps to a **single** accountId. One person, one account; a consultant
managing two hotel groups is not a case worth carrying complexity for today.

The legacy dual-writes `snapshot:latest` and `snapshot:{date}:{runId}` (unscoped) are
dropped rather than carried forward.

## Modules

- `lib/accounts/types.ts` — the interfaces above
- `lib/accounts/keys.ts` — **the only place** an `acct:` or `prop:` key string is built
- `lib/accounts/repo.ts` — `createAccount`, `getAccount`, `listProperties`,
  `getProperty`, `createProperty`, `updateProperty`, members CRUD
- `lib/accounts/context.ts` — session → `{ accountId, role }`; absorbs `lib/api/context.ts`

**Deleted:** the `PROPERTIES` array, `DEFAULT_PROPERTY_ID`, and `propKey` in
`lib/properties.ts`; the second `PROPERTIES` array in `components/shell/AppShell.tsx`
including the phantom Cookeville hotel (the switcher renders real properties).
`config/properties.json` demotes to seed data for the migration.

The scattered per-property key helpers in `lib/current-rates.ts`, `lib/rates-config.ts`,
`lib/watchlist.ts`, and `lib/ingest.ts:201` all fold into `keys.ts`.

`DEFAULT_PROPERTY_ID` currently papers over "which hotel is this?" at 14 call sites;
each becomes an explicit property from the request or session.

## Authorization: two distinct checks

`requireRole('manager')` answers *may this person write?* It does **not** answer *does
this hotel belong to them?* A manager of account A sending
`?propertyId=<account B's hotel>` passes a role check and writes to another customer's
property.

Property-scoped routes therefore call one function that verifies both:

```ts
const ctx = await requirePropertyAccess(req, 'manager');
if (!ctx.ok) return ctx.response;
// ctx.accountId, ctx.property, ctx.role — all verified
```

An unknown property and another account's property both return **404**. A 403 would
confirm the property exists, leaking the customer list.

### API keys

Property ids are unique only **within** an account, so the existing `ApiKeyRecord` —
global, scoping by bare property id via `canReadProperty` — becomes ambiguous the
moment two accounts both have a `rri-franklin`.

`ApiKeyRecord` gains an `accountId`. `canReadProperty(record, accountId, propertyId)`
requires the account to match first, then applies the existing wildcard/explicit list
against property ids within it. `scripts/create-api-key.ts` takes an account argument,
and the migration stamps existing keys with the founding account.

`/api/v1/properties` lists properties of the key's account only, replacing its current
read of the global `PROPERTIES` array.

## Session and providers

The JWT carries `accountId` alongside `role`, both resolved in `auth.ts`'s `jwt`
callback (node runtime, store access). `auth.config.ts` stays edge-safe for the
middleware and touches no store.

The `Credentials` provider is deleted from `auth.config.ts`. **To verify during
implementation:** whether `NextAuth(authConfig)` in the middleware accepts an empty
`providers` array when used purely for JWT verification. If it does not, the middleware
takes a minimal placeholder provider that authorizes nothing.

## Two kinds of invite

These are deliberately different types with different keys; conflating them is how a
team invite accidentally becomes a tenant.

| | Purpose | Key | Minted by |
|---|---|---|---|
| Signup code | Creates a **new account** | `signup:{code}` | Operator, via script; single-use |
| Team invite | Adds a person to an **existing account** | `acct:{a}:members` | That account's owner |

## Signup and onboarding

1. `/signup` takes an email and a signup code. Invalid or already-used → honest
   refusal; no account created, no email sent.
2. Valid → record `signup:pending:{email}` and send the magic link. **No account yet.**
3. On the first verified sign-in carrying a pending signup: create the account, add
   the email as `owner`, mark the code used, write `email:{addr}` → accountId, redirect
   to `/onboarding`.

Account creation happens at **verification**, not form submit — otherwise an
unverified address mints accounts.

Existing members skip all of it: `email:{addr}` resolves, role loads, straight to
`/overview`.

`/onboarding` moves **behind** the middleware. It is currently in the public exclusion
list in `middleware.ts`, which is why the mockup is reachable by anyone. An account
with zero properties is redirected to it.

The three existing steps start persisting:

- **Property** — name and address; geocoded via the Nominatim helper already in the
  watchlist route → lat/lng and timezone
- **Listings** — direct, Expedia, Booking URLs and optional Google Hotels query →
  `property.listings`
- **Competitors** — **reuses** `/api/hotel-search` and `/api/watchlist` unchanged

Finishing seeds a default `rates-config` and redirects to the dashboard.

## Migration

`scripts/migrate-accounts.ts`, run once, `--dry-run` by default following the
collector's precedent:

1. Create the founding account; add `OWNER_EMAIL` as `owner`; write `email:{addr}` → accountId
2. Create the Franklin property from `config/properties.json` and the current
   `PROPERTIES` row, with `listings` resolved from today's `RATE_URL_*` env vars
3. Copy the five already-scoped `prop:rri-franklin:*` keys under the account
4. Copy the seven global keys into property scope

The `Store` interface has **no `hgetall` and no key scan**, so the script can copy only
keys it can name, and walks hashes via their index:

- `history` — iterate `history:dates`, `hget` each, `hset` into the new key
- `notes` — the same date list plus the current snapshot's nights. **Notes on dates
  outside both are not recoverable and will be lost.**
- `actuals`, `emailed:state`, `alert:fingerprints`, `events:seen` — plain keys, copied whole
- `snapshot:{date}:{runId}` history — not migrated; 30-day TTL, and `snapshot:latest`
  is what the dashboard reads

Old keys are **left in place**, keeping the migration reversible. Re-running detects
the existing account and no-ops unless `--force`.

## Break-glass sign-in

Dropping the site password makes magic-link delivery the only door. Resend's free tier
delivers only to the Resend account owner's address until a domain is verified, so a
misconfiguration locks the operator out of production with no fallback.

`scripts/signin-link.ts` mints a valid verification token directly into the store and
prints the URL, bypassing email. Access for anyone holding store credentials.

**Deployment prerequisite:** verify a Resend domain before this ships, or confirm
magic links reach the owner address.

## Failure states

| Condition | Behavior |
|---|---|
| Signed in, no account resolves | Sign out with an explanation — never a redirect loop |
| Account with zero properties | Redirect to `/onboarding` |
| Property exists, no snapshot | "Waiting for first collection" — not zeros, not sample data |
| Signup code invalid or used | Refused at the form; no account, no email |
| Property belongs to another account | 404, identical to nonexistent |

## Testing

- **Pure** — `keys.ts` builders; role and tenant resolution; `canReadProperty` refusing
  a matching property id under a different account
- **Repo** — CRUD against `FileStore` in a temp dir, following `tests/store.test.ts`
- **Tenant isolation** — account B's *owner* receives 404 on account A's property,
  across every property-scoped route. The highest-value test in the suite: a leak here
  is a customer-data incident, not a bug
- **Structural** — extend `tests/role-guard.test.ts` so every `propertyId`-touching
  route calls `requirePropertyAccess`, and no file outside `lib/accounts/keys.ts`
  constructs an `acct:` key string
- **Migration** — against a seeded `FileStore` fixture: all seven keys land scoped,
  records are correct, a second run is a no-op

## Risks

1. **Tenant-isolation tests are load-bearing.** They are the only thing standing
   between this design and cross-customer data exposure.
2. **Notes on un-indexed dates will be lost.** Accepted under the migration decision,
   but a real loss.
3. **Lockout during cutover.** Mitigated by `scripts/signin-link.ts` and the Resend
   domain prerequisite.
4. **Onboarded properties have no data** until the collector cycle lands. Honest empty
   state, but a new customer sees an empty dashboard.
