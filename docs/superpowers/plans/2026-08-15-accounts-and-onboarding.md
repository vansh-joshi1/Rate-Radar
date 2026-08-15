# Accounts, Property Registry, and Real Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Rate Radar from a single-hotel tool into a multi-tenant one — an account owns properties, every stored artifact is scoped to both, and a new customer can sign up and onboard a real hotel.

**Architecture:** One repository module (`lib/accounts/`) owns every `acct:`/`prop:` key string; nothing else builds one. Authorization splits in two — `requireRole` asks "may they write?", `requirePropertyAccess` also asks "is this hotel theirs?" and returns 404 (never 403) for another account's property. Existing Franklin data is migrated by a named-key script, since the `Store` interface has no scan or `hgetall`.

**Tech Stack:** Next.js 14 App Router, NextAuth v5 (JWT sessions, Resend magic links), Upstash Redis via REST / local `FileStore`, vitest, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-15-accounts-and-onboarding-design.md`

---

## Phase boundary

**Phase 1 is Tasks 1–13.** At the end of it the app runs entirely on the account model with Franklin migrated, all tests green, and nothing user-visible changed. That is a safe place to stop, deploy, and verify against production before continuing.

**Phase 2 is Tasks 14–18** — signup codes and the real onboarding write path.

Do not start Task 14 until Task 13 is committed and the app has been verified running.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `lib/accounts/types.ts` | `Account`, `Member`, `Property`, `Listings` interfaces. No logic. |
| `lib/accounts/keys.ts` | The only place an `acct:`/`prop:` key string is constructed. Also validates ids. |
| `lib/accounts/repo.ts` | Account/property/member CRUD against a `Store`. No HTTP, no session. |
| `lib/accounts/context.ts` | Session → `{ accountId, role }`; `requirePropertyAccess` for route handlers. |
| `scripts/migrate-accounts.ts` | One-time migration of the Franklin data. `--dry-run` by default. |
| `scripts/signin-link.ts` | Break-glass: mint a magic-link URL directly, bypassing email. |
| `scripts/create-signup-code.ts` | Mint a single-use signup code. |
| `tests/accounts-keys.test.ts` | Key builders and id validation. |
| `tests/accounts-repo.test.ts` | Repository CRUD against `FileStore`. |
| `tests/tenant-isolation.test.ts` | The load-bearing test: account B cannot reach account A's property. |
| `tests/migrate-accounts.test.ts` | Migration correctness and idempotency. |

**Modified**

| File | Change |
|---|---|
| `lib/api/auth.ts` | `ApiKeyRecord.accountId`; `canReadProperty` takes an account. |
| `lib/ingest.ts` | Seven global keys become property-scoped; legacy dual-write deleted. |
| `lib/current-rates.ts`, `lib/rates-config.ts`, `lib/watchlist.ts` | Key helpers deleted; take `(accountId, propertyId)`. |
| `auth.ts`, `auth.config.ts`, `types/next-auth.d.ts` | Session carries `accountId`; `Credentials` provider deleted. |
| `middleware.ts` | `/onboarding` moves behind auth. |
| `app/api/*/route.ts` (7 routes) | Use `requirePropertyAccess`. |
| `app/api/v1/**` | Scope to the key's account. |
| `app/(app)/*/page.tsx`, `components/shell/AppShell.tsx` | Real properties, no `DEFAULT_PROPERTY_ID`. |
| `app/signup/page.tsx`, `app/onboarding/page.tsx` | Real write paths. |
| `tests/role-guard.test.ts` | Extended with the `requirePropertyAccess` and raw-key checks. |

**Deleted:** `lib/properties.ts` (registry, `DEFAULT_PROPERTY_ID`, `propKey`), `lib/api/context.ts` (absorbed into `lib/accounts/context.ts`).

---

# Phase 1 — the model

## Task 1: Types and key builders

**Files:**
- Create: `lib/accounts/types.ts`
- Create: `lib/accounts/keys.ts`
- Test: `tests/accounts-keys.test.ts`

Ids reach these builders from URL query parameters. An id containing `:` could forge a
key pointing at another account, so validation is a security control, not tidiness.

- [ ] **Step 1: Write the failing test**

Create `tests/accounts-keys.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { accountKey, propertyKey, globalKey, assertId, isValidId } from '../lib/accounts/keys';

describe('id validation', () => {
  it('accepts slugs and generated account ids', () => {
    expect(isValidId('rri-franklin')).toBe(true);
    expect(isValidId('acct_9f2c1b7e4a03')).toBe(true);
  });

  it('rejects ids that could forge a key', () => {
    expect(isValidId('a:prop:b')).toBe(false);
    expect(isValidId('../etc')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId('A-Upper')).toBe(false);
    expect(isValidId('x'.repeat(64))).toBe(false);
  });

  it('assertId throws on a forged id and returns a good one', () => {
    expect(() => assertId('property', 'a:b')).toThrow(/invalid property id/);
    expect(assertId('property', 'rri-franklin')).toBe('rri-franklin');
  });
});

describe('key builders', () => {
  it('builds account keys', () => {
    expect(accountKey.meta('acct_1')).toBe('acct:acct_1:meta');
    expect(accountKey.members('acct_1')).toBe('acct:acct_1:members');
    expect(accountKey.props('acct_1')).toBe('acct:acct_1:props');
  });

  it('builds property keys under their account', () => {
    expect(propertyKey.meta('acct_1', 'rri')).toBe('acct:acct_1:prop:rri:meta');
    expect(propertyKey.history('acct_1', 'rri')).toBe('acct:acct_1:prop:rri:history');
    expect(propertyKey.snapshotRun('acct_1', 'rri', '2026-08-15', 'r7'))
      .toBe('acct:acct_1:prop:rri:snapshot:2026-08-15:r7');
  });

  it('refuses to build a key from a forged id', () => {
    expect(() => propertyKey.meta('acct_1', 'x:prop:y')).toThrow(/invalid property id/);
  });

  it('lowercases the email in the account lookup key', () => {
    expect(globalKey.accountForEmail('Owner@Hotel.com')).toBe('email:owner@hotel.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/accounts-keys.test.ts`
Expected: FAIL — `Failed to load url ../lib/accounts/keys`

- [ ] **Step 3: Write the types**

Create `lib/accounts/types.ts`:

```typescript
import type { Role } from '../auth/roles';

/** Public listing URLs for a property — written at onboarding, read by the collector. */
export interface Listings {
  direct?: string;
  expedia?: string;
  booking?: string;
  googleHotelsQuery?: string;
}

export interface Account {
  id: string;
  name: string;
  createdAt: string;
}

export interface Member {
  email: string;
  role: Role;
  invitedAt: string;
}

export interface Property {
  /** Slug, unique within the account — not globally. */
  id: string;
  accountId: string;
  name: string;
  city: string;
  timezone: string;
  lat: number;
  lng: number;
  createdAt: string;
  listings: Listings;
}
```

- [ ] **Step 4: Write the key builders**

Create `lib/accounts/keys.ts`:

```typescript
/**
 * The only place an `acct:`/`prop:` key string is constructed.
 *
 * Ids arrive from URL query parameters, so an id containing ':' could forge a
 * key addressing another account's data. Every builder validates first — this
 * is a security control, and tests/role-guard.test.ts asserts no file outside
 * this one builds such a key by hand.
 */

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}$/;

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

export function assertId(kind: string, id: string): string {
  if (!isValidId(id)) throw new Error(`invalid ${kind} id`);
  return id;
}

const acct = (a: string) => `acct:${assertId('account', a)}`;
const prop = (a: string, p: string) => `${acct(a)}:prop:${assertId('property', p)}`;

export const accountKey = {
  meta: (a: string) => `${acct(a)}:meta`,
  members: (a: string) => `${acct(a)}:members`,
  props: (a: string) => `${acct(a)}:props`,
};

export const propertyKey = {
  meta: (a: string, p: string) => `${prop(a, p)}:meta`,
  snapshotLatest: (a: string, p: string) => `${prop(a, p)}:snapshot:latest`,
  snapshotRun: (a: string, p: string, date: string, runId: string) =>
    `${prop(a, p)}:snapshot:${date}:${runId}`,
  bundleLatest: (a: string, p: string) => `${prop(a, p)}:bundle:latest`,
  ratesConfig: (a: string, p: string) => `${prop(a, p)}:rates-config`,
  currentRates: (a: string, p: string) => `${prop(a, p)}:current-rates`,
  watchlist: (a: string, p: string) => `${prop(a, p)}:watchlist`,
  history: (a: string, p: string) => `${prop(a, p)}:history`,
  historyDates: (a: string, p: string) => `${prop(a, p)}:history:dates`,
  notes: (a: string, p: string) => `${prop(a, p)}:notes`,
  actuals: (a: string, p: string) => `${prop(a, p)}:actuals`,
  emailedState: (a: string, p: string) => `${prop(a, p)}:emailed:state`,
  alertFingerprints: (a: string, p: string) => `${prop(a, p)}:alert:fingerprints`,
  eventsSeen: (a: string, p: string) => `${prop(a, p)}:events:seen`,
  sourceHealth: (a: string, p: string) => `${prop(a, p)}:source-health`,
};

export const globalKey = {
  accountForEmail: (email: string) => `email:${email.trim().toLowerCase()}`,
  signupCode: (code: string) => `signup:${code}`,
  signupPending: (email: string) => `signup:pending:${email.trim().toLowerCase()}`,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/accounts-keys.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 6: Commit**

```bash
git add lib/accounts/types.ts lib/accounts/keys.ts tests/accounts-keys.test.ts
git commit -m "feat: account/property types and validated key builders"
```

---

## Task 2: Repository

**Files:**
- Create: `lib/accounts/repo.ts`
- Test: `tests/accounts-repo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/accounts-repo.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import {
  createAccount, getAccount, accountForEmail,
  createProperty, getProperty, listProperties,
  listMembers, addMember, removeMember, roleFor,
} from '../lib/accounts/repo';

function newStore() {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
}

const PROPERTY_INPUT = {
  id: 'rri-franklin',
  name: 'Red Roof Inn Franklin',
  city: 'Franklin, TN',
  timezone: 'America/Chicago',
  lat: 35.9273,
  lng: -86.8149,
  listings: { direct: 'https://example.com' },
};

describe('accounts repository', () => {
  let store: FileStore;
  beforeEach(() => { store = newStore(); });

  it('creates an account with a generated id and its owner', async () => {
    const account = await createAccount(store, 'Joshi Hospitality', 'owner@hotel.com');
    expect(account.id).toMatch(/^acct_[0-9a-f]{12}$/);
    expect(account.name).toBe('Joshi Hospitality');
    expect(await getAccount(store, account.id)).toEqual(account);
    expect(await roleFor(store, account.id, 'owner@hotel.com')).toBe('owner');
  });

  it('maps an email to its account, case-insensitively', async () => {
    const account = await createAccount(store, 'A', 'Owner@Hotel.com');
    expect(await accountForEmail(store, 'owner@hotel.com')).toBe(account.id);
    expect(await accountForEmail(store, 'OWNER@HOTEL.COM')).toBe(account.id);
  });

  it('returns null for an email with no account', async () => {
    expect(await accountForEmail(store, 'nobody@hotel.com')).toBeNull();
  });

  it('creates a property and lists it under its account', async () => {
    const account = await createAccount(store, 'A', 'owner@hotel.com');
    const property = await createProperty(store, account.id, PROPERTY_INPUT);
    expect(property.accountId).toBe(account.id);
    expect(await getProperty(store, account.id, 'rri-franklin')).toEqual(property);
    expect(await listProperties(store, account.id)).toEqual([property]);
  });

  it('refuses a duplicate property id within one account', async () => {
    const account = await createAccount(store, 'A', 'owner@hotel.com');
    await createProperty(store, account.id, PROPERTY_INPUT);
    await expect(createProperty(store, account.id, PROPERTY_INPUT)).rejects.toThrow(/already exists/);
  });

  it('allows the same property id in two different accounts', async () => {
    const a = await createAccount(store, 'A', 'a@hotel.com');
    const b = await createAccount(store, 'B', 'b@hotel.com');
    await createProperty(store, a.id, PROPERTY_INPUT);
    await createProperty(store, b.id, PROPERTY_INPUT);
    expect((await getProperty(store, a.id, 'rri-franklin'))!.accountId).toBe(a.id);
    expect((await getProperty(store, b.id, 'rri-franklin'))!.accountId).toBe(b.id);
  });

  it('does not leak a property across accounts', async () => {
    const a = await createAccount(store, 'A', 'a@hotel.com');
    const b = await createAccount(store, 'B', 'b@hotel.com');
    await createProperty(store, a.id, PROPERTY_INPUT);
    expect(await getProperty(store, b.id, 'rri-franklin')).toBeNull();
    expect(await listProperties(store, b.id)).toEqual([]);
  });

  it('adds and removes members with roles', async () => {
    const account = await createAccount(store, 'A', 'owner@hotel.com');
    await addMember(store, account.id, 'desk@hotel.com', 'viewer');
    expect(await roleFor(store, account.id, 'desk@hotel.com')).toBe('viewer');
    expect((await listMembers(store, account.id)).length).toBe(2);
    await removeMember(store, account.id, 'desk@hotel.com');
    expect(await roleFor(store, account.id, 'desk@hotel.com')).toBeNull();
  });

  it('points a new member email at the account so they can sign in', async () => {
    const account = await createAccount(store, 'A', 'owner@hotel.com');
    await addMember(store, account.id, 'desk@hotel.com', 'manager');
    expect(await accountForEmail(store, 'desk@hotel.com')).toBe(account.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/accounts-repo.test.ts`
Expected: FAIL — `Failed to load url ../lib/accounts/repo`

- [ ] **Step 3: Write the repository**

Create `lib/accounts/repo.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import type { Store } from '../store';
import type { Role } from '../auth/roles';
import { accountKey, propertyKey, globalKey, assertId } from './keys';
import type { Account, Member, Property, Listings } from './types';

/**
 * Account, property and member persistence. Pure store access — no HTTP, no
 * session. Route handlers reach this through lib/accounts/context.ts.
 */

export function newAccountId(): string {
  return `acct_${randomBytes(6).toString('hex')}`;
}

const norm = (email: string) => email.trim().toLowerCase();

export async function getAccount(store: Store, accountId: string): Promise<Account | null> {
  return store.get<Account>(accountKey.meta(accountId));
}

export async function accountForEmail(store: Store, email: string): Promise<string | null> {
  return store.get<string>(globalKey.accountForEmail(email));
}

export async function listMembers(store: Store, accountId: string): Promise<Member[]> {
  return (await store.get<Member[]>(accountKey.members(accountId))) ?? [];
}

export async function roleFor(store: Store, accountId: string, email: string): Promise<Role | null> {
  const found = (await listMembers(store, accountId)).find((m) => m.email === norm(email));
  return found?.role ?? null;
}

export async function addMember(
  store: Store, accountId: string, email: string, role: Role
): Promise<Member> {
  const members = await listMembers(store, accountId);
  const member: Member = { email: norm(email), role, invitedAt: new Date().toISOString() };
  const without = members.filter((m) => m.email !== member.email);
  await store.set(accountKey.members(accountId), [...without, member]);
  // The email→account pointer is what lets this address sign in at all.
  await store.set(globalKey.accountForEmail(member.email), accountId);
  return member;
}

export async function removeMember(store: Store, accountId: string, email: string): Promise<boolean> {
  const members = await listMembers(store, accountId);
  const remaining = members.filter((m) => m.email !== norm(email));
  if (remaining.length === members.length) return false;
  await store.set(accountKey.members(accountId), remaining);
  await store.del(globalKey.accountForEmail(norm(email)));
  return true;
}

export async function createAccount(store: Store, name: string, ownerEmail: string): Promise<Account> {
  const account: Account = { id: newAccountId(), name, createdAt: new Date().toISOString() };
  await store.set(accountKey.meta(account.id), account);
  await store.set(accountKey.props(account.id), []);
  await addMember(store, account.id, ownerEmail, 'owner');
  return account;
}

export interface PropertyInput {
  id: string;
  name: string;
  city: string;
  timezone: string;
  lat: number;
  lng: number;
  listings: Listings;
}

export async function listPropertyIds(store: Store, accountId: string): Promise<string[]> {
  return (await store.get<string[]>(accountKey.props(accountId))) ?? [];
}

export async function getProperty(
  store: Store, accountId: string, propertyId: string
): Promise<Property | null> {
  if (!(await listPropertyIds(store, accountId)).includes(propertyId)) return null;
  return store.get<Property>(propertyKey.meta(accountId, propertyId));
}

export async function listProperties(store: Store, accountId: string): Promise<Property[]> {
  const ids = await listPropertyIds(store, accountId);
  const loaded = await Promise.all(ids.map((id) => store.get<Property>(propertyKey.meta(accountId, id))));
  return loaded.filter((p): p is Property => p !== null);
}

export async function createProperty(
  store: Store, accountId: string, input: PropertyInput
): Promise<Property> {
  assertId('property', input.id);
  const ids = await listPropertyIds(store, accountId);
  if (ids.includes(input.id)) throw new Error(`property "${input.id}" already exists in this account`);

  const property: Property = { ...input, accountId, createdAt: new Date().toISOString() };
  await store.set(propertyKey.meta(accountId, property.id), property);
  await store.set(accountKey.props(accountId), [...ids, property.id]);
  return property;
}

export async function updateProperty(
  store: Store, accountId: string, propertyId: string, patch: Partial<PropertyInput>
): Promise<Property | null> {
  const existing = await getProperty(store, accountId, propertyId);
  if (!existing) return null;
  // id is identity, not data — never patched.
  const { id: _ignored, ...safe } = patch;
  const updated: Property = { ...existing, ...safe };
  await store.set(propertyKey.meta(accountId, propertyId), updated);
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/accounts-repo.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add lib/accounts/repo.ts tests/accounts-repo.test.ts
git commit -m "feat: account/property/member repository"
```

---

## Task 3: API keys become account-scoped

**Files:**
- Modify: `lib/api/auth.ts:14-21` (`ApiKeyRecord`), `:34-36` (`newKeyRecord`), `:69-71` (`canReadProperty`)
- Modify: `tests/api-auth.test.ts:26` and `:59-64`
- Test: `tests/api-auth.test.ts`

Property ids are unique only within an account, so a key scoped to `rri-franklin`
is ambiguous once two accounts each have one.

- [ ] **Step 1: Write the failing test**

In `tests/api-auth.test.ts`, replace the `scopes properties` test (currently lines 59–64) with:

```typescript
  it('scopes properties within an account: wildcard and explicit lists', () => {
    const wild = newKeyRecord('a', 'acct_1', ['*']);
    expect(canReadProperty(wild, 'acct_1', 'anything')).toBe(true);

    const scoped = newKeyRecord('b', 'acct_1', ['rri-franklin']);
    expect(canReadProperty(scoped, 'acct_1', 'rri-franklin')).toBe(true);
    expect(canReadProperty(scoped, 'acct_1', 'other-hotel')).toBe(false);
  });

  it('refuses a property id that matches under a different account', () => {
    const wild = newKeyRecord('a', 'acct_1', ['*']);
    expect(canReadProperty(wild, 'acct_2', 'rri-franklin')).toBe(false);

    const scoped = newKeyRecord('b', 'acct_1', ['rri-franklin']);
    expect(canReadProperty(scoped, 'acct_2', 'rri-franklin')).toBe(false);
  });
```

Also update the `beforeEach` on line 26 to stamp an account:

```typescript
    await store.hset(APIKEYS_HASH, hashApiKey(key), newKeyRecord('test', 'acct_1', ['*'], 5));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-auth.test.ts`
Expected: FAIL — `Expected 2 arguments, but got 3` at compile, or `canReadProperty(wild, 'acct_2', …)` returning `true`

- [ ] **Step 3: Update the record and check**

In `lib/api/auth.ts`, replace the `ApiKeyRecord` interface (lines 14–21) with:

```typescript
export interface ApiKeyRecord {
  name: string;
  createdAt: string;
  /** The account this key belongs to. Property ids are unique only within it. */
  accountId: string;
  /** Property ids this key may read, within its account; ['*'] = all of them. */
  propertyIds: string[];
  /** Requests per minute. */
  rpm: number;
}
```

Replace `newKeyRecord` (lines 34–36) with:

```typescript
export function newKeyRecord(
  name: string, accountId: string, propertyIds: string[] = ['*'], rpm = DEFAULT_RPM
): ApiKeyRecord {
  return { name, createdAt: new Date().toISOString(), accountId, propertyIds, rpm };
}
```

Replace `canReadProperty` (lines 69–71) with:

```typescript
/** The account must match first — a property id alone is not unique. */
export function canReadProperty(record: ApiKeyRecord, accountId: string, propertyId: string): boolean {
  if (record.accountId !== accountId) return false;
  return record.propertyIds.includes('*') || record.propertyIds.includes(propertyId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api-auth.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/api/auth.ts tests/api-auth.test.ts
git commit -m "feat: API keys carry an account; property scope checks it first"
```

---

## Task 4: Session carries accountId; site password deleted

**Files:**
- Modify: `auth.config.ts` (delete the `Credentials` provider and its import)
- Modify: `auth.ts:29-46` (signIn and jwt callbacks)
- Modify: `types/next-auth.d.ts`
- Modify: `lib/auth/members.ts` (delete — superseded by `lib/accounts/repo.ts`)

The credentials provider returns one global `shared-owner` identity with
`email: null` and `role: 'owner'`, belonging to no account.

- [ ] **Step 1: Extend the session type**

Replace `types/next-auth.d.ts` entirely:

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: string;
    accountId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    accountId?: string;
  }
}
```

- [ ] **Step 2: Delete the credentials provider**

Replace `auth.config.ts` entirely:

```typescript
import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config — imported by the middleware, so nothing here may
 * touch the store or filesystem. The full config (adapter + Resend provider)
 * lives in auth.ts.
 *
 * There is deliberately no credentials provider: a shared site password maps
 * to no account and would make its holder an owner in a multi-tenant system.
 * Magic link is the only door. scripts/signin-link.ts is the break-glass path.
 */
export default {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 3600 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? 'viewer';
        token.accountId = user.accountId;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? 'viewer';
        session.user.accountId = token.accountId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 3: Verify the middleware still builds with no providers**

Run: `npm run build`
Expected: PASS. If the build reports that `providers` may not be empty, add this
placeholder to `auth.config.ts` and rerun — it authorizes nothing:

```typescript
import Credentials from 'next-auth/providers/credentials';
// …
  providers: [Credentials({ id: 'disabled', credentials: {}, authorize: () => null })],
```

- [ ] **Step 4: Resolve account and role at sign-in**

Replace the `callbacks` block in `auth.ts` (lines 27–46) with:

```typescript
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      // A member of some account, or someone holding a pending signup code.
      const store = getStore();
      if (await accountForEmail(store, email)) return true;
      return Boolean(await store.get<string>(globalKey.signupPending(email)));
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const store = getStore();
        const accountId = await accountForEmail(store, user.email);
        token.name = user.name ?? token.name;
        token.accountId = accountId ?? undefined;
        token.role = accountId ? ((await roleFor(store, accountId, user.email)) ?? 'viewer') : 'viewer';
      }
      return token;
    },
  },
```

And replace the imports at the top of `auth.ts` (line 6) with:

```typescript
import { accountForEmail, roleFor } from './lib/accounts/repo';
import { globalKey } from './lib/accounts/keys';
```

- [ ] **Step 5: Delete the superseded members module**

```bash
git rm lib/auth/members.ts
```

Then in `lib/auth/guard.ts` and `lib/auth/roles.ts`, confirm `Role` is exported from
`lib/auth/roles.ts` only. Update `components/TeamManager.tsx:4` to import
`Member` and `Role` from `../lib/accounts/types` and `../lib/auth/roles` respectively.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in files later tasks touch (`app/api/members/route.ts`,
`lib/api/context.ts`, route handlers). Record the list — Tasks 5 and 9 clear it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: session carries accountId; delete shared site-password login"
```

---

## Task 5: requirePropertyAccess

**Files:**
- Create: `lib/accounts/context.ts`
- Delete: `lib/api/context.ts`
- Test: `tests/tenant-isolation.test.ts`

`requireRole` answers "may they write?". It cannot answer "is this hotel theirs?".

- [ ] **Step 1: Write the failing test**

Create `tests/tenant-isolation.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { createAccount, createProperty } from '../lib/accounts/repo';
import { resolvePropertyAccess } from '../lib/accounts/context';

const INPUT = {
  id: 'rri-franklin',
  name: 'Red Roof Inn Franklin',
  city: 'Franklin, TN',
  timezone: 'America/Chicago',
  lat: 35.9273,
  lng: -86.8149,
  listings: {},
};

describe('property access resolution', () => {
  let store: FileStore;
  let accountA: string;
  let accountB: string;

  beforeEach(async () => {
    store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
    accountA = (await createAccount(store, 'A', 'a@hotel.com')).id;
    accountB = (await createAccount(store, 'B', 'b@hotel.com')).id;
    await createProperty(store, accountA, INPUT);
  });

  it('grants a manager of the owning account', async () => {
    const res = await resolvePropertyAccess(store, accountA, 'manager', 'rri-franklin', 'manager');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.property.accountId).toBe(accountA);
  });

  it('refuses a viewer for a manager-level action', async () => {
    const res = await resolvePropertyAccess(store, accountA, 'viewer', 'rri-franklin', 'manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("returns 404 for another account's property, never 403", async () => {
    const res = await resolvePropertyAccess(store, accountB, 'owner', 'rri-franklin', 'manager');
    expect(res.ok).toBe(false);
    // 403 would confirm the property exists and leak the customer list.
    if (!res.ok) expect(res.status).toBe(404);
  });

  it('returns 404 for a property that does not exist anywhere', async () => {
    const res = await resolvePropertyAccess(store, accountA, 'owner', 'ghost-hotel', 'manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it('returns 404 rather than throwing on a forged property id', async () => {
    const res = await resolvePropertyAccess(store, accountA, 'owner', 'x:prop:y', 'manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it('returns 401 when there is no account on the session', async () => {
    const res = await resolvePropertyAccess(store, null, 'viewer', 'rri-franklin', 'manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tenant-isolation.test.ts`
Expected: FAIL — `Failed to load url ../lib/accounts/context`

- [ ] **Step 3: Write the context module**

Create `lib/accounts/context.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getStore, type Store } from '../store';
import { roleAtLeast, type Role } from '../auth/roles';
import { isValidId } from './keys';
import { getProperty } from './repo';
import type { Property } from './types';

/**
 * Authorization for property-scoped routes.
 *
 * Two questions, not one: `roleAtLeast` answers "may they write?", and the
 * property lookup answers "is this hotel theirs?". A route that asks only the
 * first lets a manager of account A write to account B by passing its
 * propertyId.
 *
 * Another account's property returns 404, identical to a nonexistent one —
 * a 403 would confirm it exists and leak the customer list.
 */

export type AccessResult =
  | { ok: true; store: Store; accountId: string; property: Property; role: Role }
  | { ok: false; status: number; response: NextResponse };

function deny(status: number, error: string): AccessResult {
  return { ok: false, status, response: NextResponse.json({ error }, { status }) };
}

/** Pure core — takes the session facts directly so it is testable without NextAuth. */
export async function resolvePropertyAccess(
  store: Store,
  accountId: string | null | undefined,
  role: string | null | undefined,
  propertyId: string,
  required: Role
): Promise<AccessResult> {
  if (!accountId) return deny(401, 'unauthorized');
  if (!roleAtLeast(role, required)) return deny(403, `${required} role required`);
  // A forged id can't address anything real; answer like any other miss.
  if (!isValidId(propertyId)) return deny(404, 'not found');

  const property = await getProperty(store, accountId, propertyId);
  if (!property) return deny(404, 'not found');

  return { ok: true, store, accountId, property, role: role as Role };
}

/** Route-handler entry point: reads the session, then delegates to the pure core. */
export async function requirePropertyAccess(req: Request, required: Role): Promise<AccessResult> {
  const { auth } = await import('../../auth');
  const session = await auth();
  const propertyId = new URL(req.url).searchParams.get('propertyId') ?? '';
  if (!propertyId) return deny(400, 'propertyId is required');

  return resolvePropertyAccess(
    getStore(),
    session?.user?.accountId,
    session?.user?.role,
    propertyId,
    required
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tenant-isolation.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Delete the superseded module**

```bash
git rm lib/api/context.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: requirePropertyAccess — role and tenancy checked together"
```

---

## Task 6: Migration script

**Files:**
- Create: `scripts/migrate-accounts.ts`
- Modify: `package.json` (add the `migrate` script)
- Test: `tests/migrate-accounts.test.ts`

The `Store` interface has no `hgetall` and no key scan, so the script copies only keys
it can name and walks hashes via their index. Old keys are left in place so the
migration is reversible.

- [ ] **Step 1: Write the failing test**

Create `tests/migrate-accounts.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { migrate } from '../scripts/migrate-accounts';
import { propertyKey } from '../lib/accounts/keys';
import { accountForEmail, getProperty } from '../lib/accounts/repo';

const SEED = {
  id: 'rri-franklin',
  name: 'Red Roof Inn Franklin',
  city: 'Franklin, TN',
  timezone: 'America/Chicago',
  lat: 35.9273,
  lng: -86.8149,
  listings: { direct: 'https://redroof.example/franklin' },
};

async function seedLegacy(store: FileStore) {
  await store.set('snapshot:latest', { runAt: '2026-08-14T12:00:00.000Z', nights: [] });
  await store.set('prop:rri-franklin:current-rates', { tiers: { standard: 72 }, updatedAt: 'x' });
  await store.set('prop:rri-franklin:watchlist', [{ name: 'Comfort Inn', addedAt: 'x' }]);
  await store.set('history:dates', ['2026-08-14', '2026-08-13']);
  await store.hset('history', '2026-08-14', { date: '2026-08-14', recommendedStandard: 72 });
  await store.hset('history', '2026-08-13', { date: '2026-08-13', recommendedStandard: 70 });
  await store.hset('notes', '2026-08-14', 'Nissan all-hands');
  await store.set('actuals', { '2026-08-14': { standard: 75 } });
  await store.set('emailed:state', { last: 'x' });
  await store.set('alert:fingerprints', { 'rate:std:70': 1 });
  await store.set('events:seen', ['evt-1']);
}

describe('migrate-accounts', () => {
  let store: FileStore;
  beforeEach(async () => {
    store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
    await seedLegacy(store);
  });

  it('dry run changes nothing', async () => {
    const result = await migrate(store, {
      accountName: 'Joshi Hospitality', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: true,
    });
    expect(result.wouldCreateAccount).toBe(true);
    expect(await accountForEmail(store, 'owner@hotel.com')).toBeNull();
  });

  it('creates the account, owner and property', async () => {
    const { accountId } = await migrate(store, {
      accountName: 'Joshi Hospitality', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false,
    });
    expect(await accountForEmail(store, 'owner@hotel.com')).toBe(accountId);
    const property = await getProperty(store, accountId!, 'rri-franklin');
    expect(property!.listings.direct).toBe('https://redroof.example/franklin');
  });

  it('moves the seven colliding keys under the property', async () => {
    const { accountId: a } = await migrate(store, {
      accountName: 'A', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false,
    });
    const p = 'rri-franklin';
    expect(await store.get(propertyKey.historyDates(a!, p))).toEqual(['2026-08-14', '2026-08-13']);
    expect(await store.hget(propertyKey.history(a!, p), '2026-08-13')).toMatchObject({ recommendedStandard: 70 });
    expect(await store.hget(propertyKey.notes(a!, p), '2026-08-14')).toBe('Nissan all-hands');
    expect(await store.get(propertyKey.actuals(a!, p))).toEqual({ '2026-08-14': { standard: 75 } });
    expect(await store.get(propertyKey.emailedState(a!, p))).toEqual({ last: 'x' });
    expect(await store.get(propertyKey.alertFingerprints(a!, p))).toEqual({ 'rate:std:70': 1 });
    expect(await store.get(propertyKey.eventsSeen(a!, p))).toEqual(['evt-1']);
  });

  it('moves the already-scoped prop: keys', async () => {
    const { accountId: a } = await migrate(store, {
      accountName: 'A', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false,
    });
    expect(await store.get(propertyKey.currentRates(a!, 'rri-franklin'))).toMatchObject({ tiers: { standard: 72 } });
    expect(await store.get(propertyKey.watchlist(a!, 'rri-franklin'))).toHaveLength(1);
    expect(await store.get(propertyKey.snapshotLatest(a!, 'rri-franklin'))).toMatchObject({ runAt: '2026-08-14T12:00:00.000Z' });
  });

  it('leaves the legacy keys in place so the migration is reversible', async () => {
    await migrate(store, { accountName: 'A', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false });
    expect(await store.get('snapshot:latest')).not.toBeNull();
    expect(await store.get('actuals')).not.toBeNull();
  });

  it('is idempotent — a second run is a no-op', async () => {
    const first = await migrate(store, { accountName: 'A', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false });
    const second = await migrate(store, { accountName: 'A', ownerEmail: 'owner@hotel.com', property: SEED, dryRun: false });
    expect(second.skipped).toBe(true);
    expect(second.accountId).toBe(first.accountId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/migrate-accounts.test.ts`
Expected: FAIL — `Failed to load url ../scripts/migrate-accounts`

- [ ] **Step 3: Write the migration**

Create `scripts/migrate-accounts.ts`:

```typescript
import { getStore, type Store } from '../lib/store';
import { createAccount, createProperty, accountForEmail, type PropertyInput } from '../lib/accounts/repo';
import { propertyKey } from '../lib/accounts/keys';

/**
 * One-time migration of the original single-hotel data into the account model.
 *
 * The Store interface has no `hgetall` and no key scan, so this copies only
 * keys it can name, and walks hashes via their index. Notes on dates outside
 * `history:dates` and the current snapshot are NOT recoverable and are lost —
 * an accepted cost recorded in the design.
 *
 * Old keys are left in place: the migration stays reversible and stale keys
 * cost a few KB. Delete them by hand once you are confident.
 */

export interface MigrateOptions {
  accountName: string;
  ownerEmail: string;
  property: PropertyInput;
  dryRun: boolean;
}

export interface MigrateResult {
  accountId: string | null;
  skipped: boolean;
  wouldCreateAccount: boolean;
  copied: string[];
  notesMigrated: number;
}

interface LegacySnapshot { runAt: string; nights?: { date: string }[] }

export async function migrate(store: Store, opts: MigrateOptions): Promise<MigrateResult> {
  const existing = await accountForEmail(store, opts.ownerEmail);
  if (existing) {
    return { accountId: existing, skipped: true, wouldCreateAccount: false, copied: [], notesMigrated: 0 };
  }
  if (opts.dryRun) {
    return { accountId: null, skipped: false, wouldCreateAccount: true, copied: [], notesMigrated: 0 };
  }

  const account = await createAccount(store, opts.accountName, opts.ownerEmail);
  const a = account.id;
  const p = opts.property.id;
  await createProperty(store, a, opts.property);

  const copied: string[] = [];
  const copyPlain = async (from: string, to: string) => {
    const value = await store.get<unknown>(from);
    if (value === null) return;
    await store.set(to, value);
    copied.push(from);
  };

  // Already property-scoped under the old layout.
  await copyPlain(`prop:${p}:current-rates`, propertyKey.currentRates(a, p));
  await copyPlain(`prop:${p}:rates-config`, propertyKey.ratesConfig(a, p));
  await copyPlain(`prop:${p}:watchlist`, propertyKey.watchlist(a, p));
  await copyPlain(`prop:${p}:bundle:latest`, propertyKey.bundleLatest(a, p));
  await copyPlain(`source:health:${p}`, propertyKey.sourceHealth(a, p));
  await copyPlain(`prop:${p}:snapshot:latest`, propertyKey.snapshotLatest(a, p));
  // The unscoped snapshot is the one the live dashboard actually reads.
  await copyPlain('snapshot:latest', propertyKey.snapshotLatest(a, p));

  // The seven that collided across properties.
  await copyPlain('actuals', propertyKey.actuals(a, p));
  await copyPlain('emailed:state', propertyKey.emailedState(a, p));
  await copyPlain('alert:fingerprints', propertyKey.alertFingerprints(a, p));
  await copyPlain('events:seen', propertyKey.eventsSeen(a, p));

  // Hashes: no hgetall, so walk the index.
  const dates = (await store.get<string[]>('history:dates')) ?? [];
  if (dates.length) {
    await store.set(propertyKey.historyDates(a, p), dates);
    copied.push('history:dates');
  }
  for (const date of dates) {
    const record = await store.hget<unknown>('history', date);
    if (record !== null) await store.hset(propertyKey.history(a, p), date, record);
  }

  // Notes are not indexed — reachable dates are the history dates plus the
  // nights in the current snapshot. Anything else is unrecoverable.
  const snapshot = await store.get<LegacySnapshot>('snapshot:latest');
  const noteDates = new Set([...dates, ...(snapshot?.nights ?? []).map((n) => n.date)]);
  let notesMigrated = 0;
  for (const date of noteDates) {
    const text = await store.hget<string>('notes', date);
    if (text !== null) {
      await store.hset(propertyKey.notes(a, p), date, text);
      notesMigrated++;
    }
  }

  return { accountId: a, skipped: false, wouldCreateAccount: false, copied, notesMigrated };
}

/** CLI entry point. Dry run unless --commit is passed. */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--commit');
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) throw new Error('Set OWNER_EMAIL — it becomes the founding account owner.');

  const property: PropertyInput = {
    id: 'rri-franklin',
    name: 'Red Roof Inn Franklin',
    city: 'Franklin, TN',
    timezone: 'America/Chicago',
    lat: 35.9273,
    lng: -86.8149,
    listings: {
      direct: process.env.RATE_URL_REDROOF,
      expedia: process.env.RATE_URL_EXPEDIA,
      booking: process.env.RATE_URL_BOOKING,
      googleHotelsQuery: process.env.GOOGLE_HOTELS_QUERY,
    },
  };

  const result = await migrate(getStore(), {
    accountName: process.env.ACCOUNT_NAME ?? 'Red Roof Inn Franklin',
    ownerEmail, property, dryRun,
  });

  if (result.skipped) {
    console.log(`Already migrated — account ${result.accountId}. Nothing to do.`);
    return;
  }
  if (dryRun) {
    console.log('DRY RUN — nothing written. Re-run with --commit to apply.');
    console.log(`Would create an account owned by ${ownerEmail} and migrate property ${property.id}.`);
    return;
  }
  console.log(`Migrated into account ${result.accountId}`);
  console.log(`  keys copied:     ${result.copied.length}`);
  console.log(`  notes migrated:  ${result.notesMigrated}`);
  console.log('Legacy keys left in place — delete them by hand once verified.');
}

if (process.argv[1]?.includes('migrate-accounts')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/migrate-accounts.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `scripts`:

```json
    "migrate": "tsx scripts/migrate-accounts.ts",
```

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-accounts.ts tests/migrate-accounts.test.ts package.json
git commit -m "feat: one-time migration of Franklin data into the account model"
```

---

## Task 7: Break-glass sign-in script

**Files:**
- Create: `scripts/signin-link.ts`
- Modify: `package.json`

With the site password gone, magic-link delivery is the only door. Resend's free tier
delivers only to the Resend account owner's address until a domain is verified.

- [ ] **Step 1: Write the script**

Create `scripts/signin-link.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import { getStore } from '../lib/store';
import { accountForEmail } from '../lib/accounts/repo';

/**
 * Break-glass sign-in. Mints a verification token directly into the store and
 * prints the magic-link URL, bypassing email entirely.
 *
 * This exists because deleting the shared site password made email delivery the
 * only way in: a Resend misconfiguration would otherwise lock the operator out
 * of production with no recourse. Requires store credentials, so it is exactly
 * as privileged as the database itself.
 *
 * Usage: npm run signin -- owner@hotel.com
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run signin -- you@example.com');

  const store = getStore();
  const accountId = await accountForEmail(store, email);
  if (!accountId) throw new Error(`${email} is not a member of any account.`);

  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 15 * 60 * 1000;
  // Matches the verification-token key shape in lib/auth/adapter.ts.
  await store.set(`auth:vt:${email}:${token}`, { identifier: email, token, expires }, 900);

  const base = (process.env.DASHBOARD_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const url = `${base}/api/auth/callback/resend?token=${token}&email=${encodeURIComponent(email)}`;
  console.log(`Sign-in link for ${email} (account ${accountId}), valid 15 minutes:\n\n${url}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Confirm the token key shape matches the adapter**

Run: `grep -n "vtKey\|auth:vt" lib/auth/adapter.ts`
Expected: `const vtKey = (identifier: string, token: string) => \`auth:vt:${identifier.toLowerCase()}:${token}\`;`

If the shape differs, correct `signin-link.ts` to match the adapter exactly — a
mismatch produces a link that silently fails.

- [ ] **Step 3: Add the npm script**

In `package.json`, add to `scripts`:

```json
    "signin": "tsx scripts/signin-link.ts",
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 5: Commit**

```bash
git add scripts/signin-link.ts package.json
git commit -m "feat: break-glass sign-in link script"
```

---

## Task 8: Ingest writes account-scoped keys

**Files:**
- Modify: `lib/ingest.ts:72` (property resolution), `:201-202`, `:223-231`, `:236-253`
- Modify: `app/api/ingest/route.ts`
- Modify: `config/properties.json` (add `accountId`), `collector/properties.ts`
- Test: `tests/ingest-shapes.test.ts`

The ingest route is authenticated by `INGEST_SECRET`, not a session, so it has no
account to infer — and property ids are unique only within an account, so it cannot
look one up. **The bundle must carry `accountId` explicitly.** That is a one-field
collector change, not the full collector multi-tenancy cycle.

- [ ] **Step 1: Add accountId to the bundle type and collector config**

In `lib/ingest.ts`, add to the `Bundle` interface:

```typescript
  /** Which account owns the property this bundle is for. Required — property ids are not globally unique. */
  accountId: string;
```

In `config/properties.json`, add `"accountId": "env:ACCOUNT_ID"` to the Franklin entry.

In `collector/properties.ts`, add `accountId: string;` to `RatePropertyConfig` and
`RawProperty`, and inside the `loadProperties` map add:

```typescript
      accountId: resolve(p.accountId) ?? '',
```

In `collector/index.ts`, include `accountId: prop.accountId` in the bundle it POSTs.

- [ ] **Step 2: Write the failing test**

Add to `tests/ingest-shapes.test.ts`:

```typescript
import { propertyKey } from '../lib/accounts/keys';

it('writes every artifact under the bundle account and property', async () => {
  const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
  const bundle = makeBundle({ accountId: 'acct_abc123abc123', propertyId: 'rri-franklin' });

  await processBundle(bundle, store);

  const a = 'acct_abc123abc123';
  const p = 'rri-franklin';
  expect(await store.get(propertyKey.snapshotLatest(a, p))).not.toBeNull();
  expect(await store.get(propertyKey.historyDates(a, p))).not.toBeNull();
  // The legacy unscoped keys must no longer be written at all.
  expect(await store.get('snapshot:latest')).toBeNull();
  expect(await store.get('history:dates')).toBeNull();
  expect(await store.get('actuals')).toBeNull();
});
```

Use the existing `makeBundle` helper in that file, extending it to accept `accountId`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/ingest-shapes.test.ts`
Expected: FAIL — `snapshot:latest` is not null, scoped keys are null

- [ ] **Step 4: Rewrite the key usage in processBundle**

In `lib/ingest.ts`, replace line 72 with:

```typescript
  const accountId = bundle.accountId;
  const propertyId = bundle.propertyId;
  if (!accountId || !propertyId) throw new Error('bundle must carry accountId and propertyId');
```

Replace line 201 with:

```typescript
  const healthKey = propertyKey.sourceHealth(accountId, propertyId);
```

Replace the snapshot/bundle block (lines 223–231) with:

```typescript
  await store.set(propertyKey.snapshotLatest(accountId, propertyId), snapshot);
  await store.set(propertyKey.snapshotRun(accountId, propertyId, today, runId), snapshot, 30 * 86400);
  await store.set(propertyKey.bundleLatest(accountId, propertyId), bundle);
```

Replace the history block (lines 236–248) with:

```typescript
  await store.hset(propertyKey.history(accountId, propertyId), today, {
    date: today,
    recommendedStandard: std?.recommended ?? 0,
    recommendedSuperior: superior?.recommended ?? 0,
    nightScore: todayNight.nightScore,
    topDriver: todayNight.events[0]?.name ?? 'none',
    recordedAt: now.toISOString(),
  });

  const datesKey = propertyKey.historyDates(accountId, propertyId);
  const historyDates = (await store.get<string[]>(datesKey)) ?? [];
  if (!historyDates.includes(today)) {
    await store.set(datesKey, [today, ...historyDates].slice(0, 400));
  }
```

Replace lines 250–252 with:

```typescript
  await store.set(propertyKey.emailedState(accountId, propertyId), alertResult.newEmailedState);
  await store.set(propertyKey.alertFingerprints(accountId, propertyId), alertResult.newFingerprints);
  await store.set(propertyKey.eventsSeen(accountId, propertyId), alertResult.newSeenEventIds);
```

Do the same for the corresponding **reads** earlier in the function — `emailed:state`,
`alert:fingerprints` and `events:seen` are loaded before `evaluateAlerts`. Replace the
import of `./properties` (line 10) with:

```typescript
import { propertyKey } from './accounts/keys';
```

- [ ] **Step 5: Reject an unknown account/property at the ingest route**

In `app/api/ingest/route.ts`, after the bearer check and before `processBundle`:

```typescript
  const property = await getProperty(getStore(), bundle.accountId, bundle.propertyId);
  if (!property) {
    return NextResponse.json({ error: 'unknown account or property' }, { status: 404 });
  }
```

with `import { getProperty } from '../../../lib/accounts/repo';`

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS. `tests/recompute.test.ts` and other ingest-touching tests will need
their fixtures given an `accountId` — add `accountId: 'acct_test00000'` to each bundle
fixture and create the matching account and property in those tests' setup.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: ingest writes account-scoped keys; legacy dual-write removed"
```

---

## Task 9: Property-scoped route handlers

**Files:**
- Modify: `app/api/current-rates/route.ts`, `app/api/rates-config/route.ts`, `app/api/watchlist/route.ts`, `app/api/recompute/route.ts`, `app/api/actual/route.ts`, `app/api/note/route.ts`, `app/api/hotel-search/route.ts`
- Modify: `lib/current-rates.ts`, `lib/rates-config.ts`, `lib/watchlist.ts`

Every one of these currently defaults to `DEFAULT_PROPERTY_ID` when no `propertyId` is
passed — which in a multi-tenant system means "silently act on the founding customer's
hotel". The default is removed; `propertyId` becomes required.

- [ ] **Step 1: Move the key helpers**

In `lib/current-rates.ts`, delete `currentRatesKey` (line 16) and change
`loadCurrentRates`/`saveCurrentRates` to take `(store, accountId, propertyId, …)`,
using `propertyKey.currentRates(accountId, propertyId)`.

Do the same in `lib/rates-config.ts` (delete `ratesConfigKey`, use
`propertyKey.ratesConfig`) and `lib/watchlist.ts` (delete `watchlistKey`, use
`propertyKey.watchlist`).

- [ ] **Step 2: Convert one route and confirm the shape**

Replace the body of `PUT` in `app/api/current-rates/route.ts` with:

```typescript
export async function PUT(req: NextRequest) {
  const access = await requirePropertyAccess(req, 'manager');
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => null)) as { tiers?: Record<string, number> } | null;
  if (!body?.tiers) return NextResponse.json({ error: 'body must be { tiers: { tierId: rate } }' }, { status: 400 });

  const problem = validateCurrentRates(body.tiers);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const rates = { tiers: body.tiers, updatedAt: new Date().toISOString() };
  await saveCurrentRates(access.store, access.accountId, access.property.id, rates);
  return NextResponse.json({ ok: true, rates });
}
```

and `GET` with:

```typescript
export async function GET(req: NextRequest) {
  const access = await requirePropertyAccess(req, 'viewer');
  if (!access.ok) return access.response;
  const rates = await loadCurrentRates(access.store, access.accountId, access.property.id);
  return NextResponse.json({ propertyId: access.property.id, rates });
}
```

Delete the `propertyIdFrom` helper and the `DEFAULT_PROPERTY_ID`/`getProperty` import.

- [ ] **Step 3: Apply the identical shape to the remaining routes**

`app/api/rates-config/route.ts` — `GET` at `'viewer'`, `PUT` at `'manager'`, calling
`loadRatesConfig`/`saveRatesConfig` with `(access.store, access.accountId, access.property.id)`.

`app/api/watchlist/route.ts` — `GET` keeps the `isCollector` bypass **for the collector
only**; when not the collector it uses `requirePropertyAccess(req, 'viewer')`. `POST`,
`PATCH` and `DELETE` use `requirePropertyAccess(req, 'manager')` and pass
`access.property.city` to `geocode` instead of looking the property up again.

`app/api/recompute/route.ts` — `POST` at `'manager'`; read the bundle from
`propertyKey.bundleLatest(access.accountId, access.property.id)`.

`app/api/actual/route.ts` — `POST` at `'manager'`; read/write
`propertyKey.actuals(access.accountId, access.property.id)` instead of `'actuals'`.

`app/api/note/route.ts` — `POST` at `'manager'`; `hset` into
`propertyKey.notes(access.accountId, access.property.id)` instead of `'notes'`.

`app/api/hotel-search/route.ts` — use `requirePropertyAccess(req, 'viewer')` and take
the search centre from `access.property.lat/lng`.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `app/(app)/**` pages and `app/api/v1/**` — Tasks 10 and 11.

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: property routes verify tenancy; no default property"
```

---

## Task 10: v1 API scoped to the key's account

**Files:**
- Modify: `app/api/v1/properties/route.ts`, `app/api/v1/properties/[id]/rates/route.ts`, `app/api/v1/properties/[id]/compset/route.ts`, `app/api/v1/properties/[id]/recommendations/route.ts`
- Modify: `scripts/create-api-key.ts`

- [ ] **Step 1: Rebuild the shared context in the v1 routes**

`lib/api/context.ts` was deleted in Task 5. Add its replacement to
`lib/accounts/context.ts`:

```typescript
import { authenticate, canReadProperty, apiError } from '../api/auth';
import { propertyKey } from './keys';
import type { Snapshot } from '../scoring/types';

export interface ApiContext {
  store: Store;
  accountId: string;
  property: Property;
  snapshot: Snapshot;
  ageMinutes: number;
}

/** API-key equivalent of requirePropertyAccess, for the v1 endpoints. */
export async function apiPropertyContext(req: Request, propertyId: string): Promise<ApiContext | Response> {
  const store = getStore();
  const auth = await authenticate(req, store);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const accountId = auth.record.accountId;
  if (!canReadProperty(auth.record, accountId, propertyId)) {
    return apiError(404, 'not_found', 'No such property.');
  }
  const property = await getProperty(store, accountId, propertyId);
  if (!property) return apiError(404, 'not_found', 'No such property.');

  const snapshot = await store.get<Snapshot>(propertyKey.snapshotLatest(accountId, propertyId));
  if (!snapshot) return apiError(404, 'no_data', 'No collector data for this property yet.');

  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  return { store, accountId, property, snapshot, ageMinutes };
}
```

Keep the existing `provenance()` helper, moving it here and taking `ApiContext`.

- [ ] **Step 2: Point the three per-property routes at it**

In each of `rates`, `compset` and `recommendations`, replace the
`propertyContext(...)` call with `apiPropertyContext(...)` and update the import to
`../../../../../../lib/accounts/context`.

- [ ] **Step 3: List only the key's own account**

Replace the body of `app/api/v1/properties/route.ts`'s handler with:

```typescript
  const store = getStore();
  const auth = await authenticate(req, store);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const all = await listProperties(store, auth.record.accountId);
  const visible = all.filter((p) => canReadProperty(auth.record, auth.record.accountId, p.id));
```

with `import { listProperties } from '../../../../lib/accounts/repo';`

- [ ] **Step 4: Update the key-minting script**

In `scripts/create-api-key.ts`, take an `--account` argument (required) and pass it to
`newKeyRecord(name, accountId, propertyIds, rpm)`. Fail with a clear message when it is
missing.

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no errors in `app/api/**`; tests PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: v1 API scoped to the key's account"
```

---

## Task 11: Pages and the property switcher

**Files:**
- Modify: `app/(app)/layout.tsx`, `app/(app)/overview/page.tsx`, `app/(app)/competitors/page.tsx`, `app/(app)/settings/page.tsx`
- Modify: `components/shell/AppShell.tsx:21-24`
- Modify: `lib/dashboard-data.ts`

Server components need to know *which* property. The switcher writes a cookie; the
account's first property is the fallback.

- [ ] **Step 1: Add the current-property resolver**

Add to `lib/accounts/context.ts`:

```typescript
import { cookies } from 'next/headers';

export const PROPERTY_COOKIE = 'rr_property';

export interface SessionProperties {
  accountId: string | null;
  properties: Property[];
  current: Property | null;
}

/**
 * Which property is this page about? The switcher writes a cookie; otherwise
 * the account's first property. Returns current: null when the account has no
 * properties yet — the caller redirects to onboarding.
 */
export async function sessionProperties(): Promise<SessionProperties> {
  const { auth } = await import('../../auth');
  const session = await auth();
  const accountId = session?.user?.accountId ?? null;
  if (!accountId) return { accountId: null, properties: [], current: null };

  const properties = await listProperties(getStore(), accountId);
  const preferred = cookies().get(PROPERTY_COOKIE)?.value;
  const current = properties.find((p) => p.id === preferred) ?? properties[0] ?? null;
  return { accountId, properties, current };
}
```

with `import { listProperties } from './repo';`

- [ ] **Step 2: Redirect an account with no properties**

In `app/(app)/layout.tsx`, replace the data load with:

```typescript
  const { accountId, properties, current } = await sessionProperties();
  if (!accountId) redirect('/login');
  if (!current) redirect('/onboarding');

  const { snapshot, isDemo } = await loadSnapshot(accountId, current.id);
```

with `import { redirect } from 'next/navigation';` and
`import { sessionProperties } from '../../lib/accounts/context';`

Pass `properties` and `current` into `AppShell`.

- [ ] **Step 3: Make the switcher render real properties**

In `components/shell/AppShell.tsx`, delete the hardcoded `PROPERTIES` array (lines
21–24, including the phantom "Sunrise Suites — Cookeville, TN (demo)"). Accept
properties as props:

```typescript
  properties?: { id: string; name: string; city: string }[];
  currentPropertyId?: string;
```

and render the `<select>` from `properties`, with `value={currentPropertyId}` and an
`onChange` that sets `document.cookie = \`rr_property=\${id};path=/;max-age=31536000\``
then calls `router.refresh()`.

- [ ] **Step 4: Thread the property through the pages**

`lib/dashboard-data.ts` — `loadSnapshot(accountId, propertyId)` reads
`propertyKey.snapshotLatest(accountId, propertyId)`, keeping its existing demo
fallback.

`app/(app)/overview/page.tsx` — take `accountId` and `current` from
`sessionProperties()`; pass `current.id` where `DEFAULT_PROPERTY_ID` was used at lines
31 and 127; load notes and actuals from the scoped keys.

`app/(app)/competitors/page.tsx` — use `current` instead of
`getProperty(DEFAULT_PROPERTY_ID)!` at line 27.

`app/(app)/settings/page.tsx` — it is a client component, so accept `propertyId` as a
prop from a small server wrapper and pass it to `BaselineEditor` (replacing
`DEFAULT_PROPERTY_ID` at line 53).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: pages resolve the current property; switcher shows real hotels"
```

---

## Task 12: Delete the old registry

**Files:**
- Delete: `lib/properties.ts`
- Modify: `config/properties.json` (comment update)

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "lib/properties\|DEFAULT_PROPERTY_ID\|propKey" --include="*.ts" --include="*.tsx" app lib components collector scripts`
Expected: no output. If anything remains, convert it before deleting.

- [ ] **Step 2: Delete**

```bash
git rm lib/properties.ts
```

- [ ] **Step 3: Update the config comment**

In `config/properties.json`, replace `_comment` with:

```json
  "_comment": "Collector-side seed config. The registry of record is the store (acct:{id}:prop:{id}:meta) — this file supplies scrape settings and the accountId for the collector run. Values starting with 'env:' resolve from that environment variable at collect time.",
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete the hardcoded property registry"
```

---

## Task 13: Structural guards

**Files:**
- Modify: `tests/role-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/role-guard.test.ts`:

```typescript
describe('property-scoped routes verify tenancy', () => {
  const API_DIR = join(__dirname, '..', 'app', 'api');

  /** Routes that legitimately take a propertyId without a user session. */
  const NON_SESSION: Record<string, string> = {
    'ingest/route.ts': 'INGEST_SECRET bearer; account and property validated inline',
  };

  for (const file of routeFiles(API_DIR)) {
    const rel = relative(API_DIR, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    if (!source.includes('propertyId')) continue;
    if (rel.startsWith('v1/') || rel in NON_SESSION) continue;

    it(`${rel} calls requirePropertyAccess`, () => {
      expect(source).toMatch(/requirePropertyAccess\(/);
    });
  }

  it('v1 routes use the API-key property context', () => {
    for (const file of routeFiles(join(API_DIR, 'v1'))) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('propertyId') && !source.includes('params')) continue;
      expect(source).toMatch(/apiPropertyContext\(|authenticate\(/);
    }
  });
});

describe('key construction is confined to lib/accounts/keys.ts', () => {
  const ROOTS = ['app', 'lib', 'components', 'collector', 'scripts'];
  const RAW_KEY = /['"`]acct:|['"`]prop:/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it('no file outside keys.ts builds an acct:/prop: string', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(join(__dirname, '..', root))) {
        if (file.endsWith(join('lib', 'accounts', 'keys.ts'))) continue;
        if (RAW_KEY.test(readFileSync(file, 'utf8'))) {
          offenders.push(relative(join(__dirname, '..'), file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

Add `readdirSync` to the existing `node:fs` import if it is not already there.

- [ ] **Step 2: Run to verify it fails or passes for the right reason**

Run: `npx vitest run tests/role-guard.test.ts`
Expected: PASS if Tasks 9–12 were complete. **Any failure here is a real finding** —
fix the offending route or key usage, not the test.

- [ ] **Step 3: Full verification**

Run: `npm test`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: no output

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/role-guard.test.ts
git commit -m "test: structural guards for tenancy checks and key construction"
```

---

## Phase 1 checkpoint

Before starting Task 14:

1. Run the migration against production with `--dry-run`, read the output, then `--commit`.
2. Confirm the dashboard renders Franklin's real data from the scoped keys.
3. Confirm a magic-link sign-in works end to end — **and** that `npm run signin -- <email>` produces a working link.
4. Confirm a collector run ingests successfully with the new `accountId` field.

Do not continue until all four hold.

---

# Phase 2 — signup and onboarding

## Task 14: Signup codes

**Files:**
- Create: `lib/accounts/signup.ts`
- Create: `scripts/create-signup-code.ts`
- Create: `app/api/signup/route.ts`
- Test: `tests/signup.test.ts`
- Modify: `package.json`

A **signup code** creates a new account. A **team invite** adds a person to an existing
one. Different types, different keys — conflating them is how a team invite
accidentally becomes a tenant.

- [ ] **Step 1: Write the failing test**

Create `tests/signup.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { createSignupCode, claimSignupCode, redeemPendingSignup } from '../lib/accounts/signup';
import { accountForEmail, roleFor, listPropertyIds } from '../lib/accounts/repo';

describe('signup codes', () => {
  let store: FileStore;
  beforeEach(() => {
    store = new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-test-')), 'store.json'));
  });

  it('mints a code in the documented shape', async () => {
    const code = await createSignupCode(store, 'for a pilot hotel');
    expect(code).toMatch(/^rrsu_[0-9a-f]{16}$/);
  });

  it('claims a valid code, recording a pending signup without creating an account', async () => {
    const code = await createSignupCode(store, 'note');
    const result = await claimSignupCode(store, 'new@hotel.com', code);
    expect(result.ok).toBe(true);
    // An unverified address must not mint an account.
    expect(await accountForEmail(store, 'new@hotel.com')).toBeNull();
  });

  it('refuses an unknown code', async () => {
    const result = await claimSignupCode(store, 'new@hotel.com', 'rrsu_0000000000000000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('refuses a code that was already redeemed', async () => {
    const code = await createSignupCode(store, 'note');
    await claimSignupCode(store, 'first@hotel.com', code);
    await redeemPendingSignup(store, 'first@hotel.com', 'First Hotel');
    const second = await claimSignupCode(store, 'second@hotel.com', code);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('used');
  });

  it('refuses an email that already belongs to an account', async () => {
    const code = await createSignupCode(store, 'note');
    await claimSignupCode(store, 'new@hotel.com', code);
    await redeemPendingSignup(store, 'new@hotel.com', 'A Hotel');
    const again = await claimSignupCode(store, 'new@hotel.com', await createSignupCode(store, 'x'));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('exists');
  });

  it('redeeming creates the account with the email as owner and no properties', async () => {
    const code = await createSignupCode(store, 'note');
    await claimSignupCode(store, 'new@hotel.com', code);
    const account = await redeemPendingSignup(store, 'new@hotel.com', 'New Hotel Group');

    expect(account).not.toBeNull();
    expect(await accountForEmail(store, 'new@hotel.com')).toBe(account!.id);
    expect(await roleFor(store, account!.id, 'new@hotel.com')).toBe('owner');
    expect(await listPropertyIds(store, account!.id)).toEqual([]);
  });

  it('redeeming without a pending signup does nothing', async () => {
    expect(await redeemPendingSignup(store, 'stranger@hotel.com', 'X')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/signup.test.ts`
Expected: FAIL — `Failed to load url ../lib/accounts/signup`

- [ ] **Step 3: Write the signup module**

Create `lib/accounts/signup.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import type { Store } from '../store';
import { globalKey } from './keys';
import { accountForEmail, createAccount } from './repo';
import type { Account } from './types';

/**
 * Signup codes — the gate on account creation.
 *
 * Distinct from a team invite, which adds a person to an EXISTING account.
 * A code creates a NEW tenant, so it is single-use and minted only by an
 * operator running scripts/create-signup-code.ts.
 *
 * An account is created at magic-link VERIFICATION, not at form submit —
 * otherwise an unverified address could mint tenants.
 */

interface SignupCode {
  code: string;
  note: string;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
}

interface PendingSignup {
  email: string;
  code: string;
  claimedAt: string;
}

export async function createSignupCode(store: Store, note: string): Promise<string> {
  const code = `rrsu_${randomBytes(8).toString('hex')}`;
  const record: SignupCode = { code, note, createdAt: new Date().toISOString() };
  await store.set(globalKey.signupCode(code), record);
  return code;
}

export type ClaimResult = { ok: true } | { ok: false; reason: 'invalid' | 'used' | 'exists' };

export async function claimSignupCode(store: Store, email: string, code: string): Promise<ClaimResult> {
  if (await accountForEmail(store, email)) return { ok: false, reason: 'exists' };

  const record = await store.get<SignupCode>(globalKey.signupCode(code));
  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedBy) return { ok: false, reason: 'used' };

  const pending: PendingSignup = { email: email.trim().toLowerCase(), code, claimedAt: new Date().toISOString() };
  // 24h: long enough to click a magic link, short enough that a stale claim clears.
  await store.set(globalKey.signupPending(email), pending, 24 * 3600);
  return { ok: true };
}

/** Called once the magic link is verified. Returns null when there is nothing pending. */
export async function redeemPendingSignup(
  store: Store, email: string, accountName: string
): Promise<Account | null> {
  const pending = await store.get<PendingSignup>(globalKey.signupPending(email));
  if (!pending) return null;
  if (await accountForEmail(store, email)) return null;

  const record = await store.get<SignupCode>(globalKey.signupCode(pending.code));
  if (!record || record.usedBy) return null;

  const account = await createAccount(store, accountName, email);
  await store.set(globalKey.signupCode(pending.code), {
    ...record, usedBy: email.trim().toLowerCase(), usedAt: new Date().toISOString(),
  });
  await store.del(globalKey.signupPending(email));
  return account;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/signup.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Redeem at verification time**

In `auth.ts`, inside the `jwt` callback, before resolving the account:

```typescript
      if (user?.email) {
        const store = getStore();
        // First sign-in after a claimed signup code creates the tenant.
        await redeemPendingSignup(store, user.email, user.email.split('@')[1] ?? 'My hotel');
        const accountId = await accountForEmail(store, user.email);
```

with `import { redeemPendingSignup } from './lib/accounts/signup';`

The account name defaults to the email domain and is editable in onboarding.

- [ ] **Step 6: Add the claim endpoint**

Create `app/api/signup/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '../../../lib/store';
import { claimSignupCode } from '../../../lib/accounts/signup';

export const dynamic = 'force-dynamic';

/** Validates a signup code and records a pending signup. Creates no account. */
export async function POST(req: NextRequest) {
  const { email, code } = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  if (!email || !code) return NextResponse.json({ error: 'email and code are required' }, { status: 400 });

  const result = await claimSignupCode(getStore(), email, code);
  if (result.ok) return NextResponse.json({ ok: true });

  const message = {
    invalid: 'That signup code is not valid.',
    used: 'That signup code has already been used.',
    exists: 'That email already has an account — sign in instead.',
  }[result.reason];
  return NextResponse.json({ error: message }, { status: 400 });
}
```

Add `api/signup` to the middleware's public exclusion list in `middleware.ts`.

- [ ] **Step 7: Write the minting script**

Create `scripts/create-signup-code.ts`:

```typescript
import { getStore } from '../lib/store';
import { createSignupCode } from '../lib/accounts/signup';

/** Usage: npm run signupcode -- "pilot hotel in Cookeville" */
async function main() {
  const note = process.argv.slice(2).join(' ').trim();
  if (!note) throw new Error('Usage: npm run signupcode -- "why this code exists"');
  const code = await createSignupCode(getStore(), note);
  console.log(`Signup code (single use): ${code}\n  note: ${note}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

In `package.json` add: `"signupcode": "tsx scripts/create-signup-code.ts",`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: single-use signup codes create accounts at link verification"
```

---

## Task 15: Signup page takes a code

**Files:**
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Rewrite the form**

Replace the `submit` handler and form in `app/signup/page.tsx`:

```typescript
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    setError(null);

    const data = new FormData(e.currentTarget);
    const email = String(data.get('email'));
    const code = String(data.get('code')).trim();

    // Validate the code before sending any email.
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? 'Could not start signup.');
      setState('idle');
      return;
    }

    await signIn('resend', { email, redirect: false, callbackUrl: '/onboarding' });
    setState('sent');
  }
```

Add the code field above the submit button:

```tsx
          <div className="mb-4">
            <label className="label" htmlFor="code">Signup code</label>
            <input id="code" name="code" className="field font-mono" placeholder="rrsu_…" required />
          </div>
```

Update the explanatory copy to say Rate Radar is invite-only and a signup code comes
from the Rate Radar team, and render `{error}` where the old `denied` state was.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: signup validates a code before sending a magic link"
```

---

## Task 16: Onboarding writes a real property

**Files:**
- Create: `app/api/onboarding/route.ts`
- Modify: `app/onboarding/page.tsx`
- Modify: `middleware.ts:29`

- [ ] **Step 1: Put onboarding behind auth**

In `middleware.ts`, remove `onboarding` from the negative lookahead on line 29, and add
`api/signup`. The matcher becomes:

```typescript
    '/((?!$|login|signup|api/auth|api/signup|api/ingest|api/v1|api/health|api/watchlist|api/cron|_next/static|_next/image|favicon.ico|robots.txt|originid.global.js).*)',
```

- [ ] **Step 2: Write the create endpoint**

Create `app/api/onboarding/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '../../../auth';
import { getStore } from '../../../lib/store';
import { createProperty, listPropertyIds } from '../../../lib/accounts/repo';
import { isValidId } from '../../../lib/accounts/keys';
import { saveRatesConfig } from '../../../lib/rates-config';
import defaultRates from '../../../config/rates.json';
import type { RatesConfig } from '../../../lib/rates-config';

export const dynamic = 'force-dynamic';

/** Creates the account's property from the onboarding wizard. Owner only. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const accountId = session?.user?.accountId;
  if (!accountId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session?.user?.role !== 'owner') {
    return NextResponse.json({ error: 'owner role required' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string; city?: string; lat?: number; lng?: number;
    timezone?: string; listings?: Record<string, string>;
  };

  const name = body.name?.trim() ?? '';
  const city = body.city?.trim() ?? '';
  if (name.length < 3 || name.length > 80) return NextResponse.json({ error: 'name must be 3–80 characters' }, { status: 400 });
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
    return NextResponse.json({ error: 'the property could not be located — check the address' }, { status: 400 });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!isValidId(id)) return NextResponse.json({ error: 'could not derive an id from that name' }, { status: 400 });

  const store = getStore();
  if ((await listPropertyIds(store, accountId)).includes(id)) {
    return NextResponse.json({ error: 'a property with that name already exists' }, { status: 409 });
  }

  const property = await createProperty(store, accountId, {
    id, name, city,
    timezone: body.timezone ?? 'America/Chicago',
    lat: body.lat!, lng: body.lng!,
    listings: {
      direct: body.listings?.direct,
      expedia: body.listings?.expedia,
      booking: body.listings?.booking,
      googleHotelsQuery: body.listings?.googleHotelsQuery,
    },
  });

  // Seed baselines so the dashboard has something to compute against.
  await saveRatesConfig(store, accountId, id, defaultRates as RatesConfig);

  return NextResponse.json({ ok: true, property });
}
```

- [ ] **Step 3: Make the wizard persist**

In `app/onboarding/page.tsx`, convert to a client component holding all three steps'
state. Step 1 collects name and address and geocodes it by calling the existing
`/api/hotel-search` endpoint. Step 2 collects the three listing URLs (delete the
hardcoded `defaultValue="https://redroof-franklin.com"`). Step 3 finishes:

```typescript
  async function finish() {
    setBusy(true);
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city, lat, lng, timezone, listings }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setError(json.error ?? 'Could not create the property.'); setBusy(false); return; }
    // Competitors are added from the dashboard, which reuses the existing watchlist UI.
    window.location.href = '/competitors';
  }
```

Delete the `action="/overview"` form and the "Demo flow" comment on line 47.

- [ ] **Step 4: Build and test**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: onboarding creates a real property behind auth"
```

---

## Task 17: Honest empty state

**Files:**
- Modify: `app/(app)/overview/page.tsx`, `lib/dashboard-data.ts`

A property created through onboarding has no collector data and will not until the
collector multi-tenancy cycle. Show that plainly — not zeros, not sample data.

- [ ] **Step 1: Distinguish "no data" from "demo data"**

In `lib/dashboard-data.ts`, have `loadSnapshot(accountId, propertyId)` return
`{ snapshot: null, isDemo: false }` when the scoped key is empty **and** the property is
not the migrated Franklin one, rather than falling back to demo data.

- [ ] **Step 2: Render the waiting state**

At the top of `app/(app)/overview/page.tsx`'s render, when `snapshot` is null:

```tsx
    return (
      <div className="card">
        <h2 className="mb-2 text-xl font-bold tracking-tight">Waiting for first collection</h2>
        <p className="text-sm text-muted">
          {property.name} is set up, but no collection run has produced data for it yet. Recommendations,
          competitor prices and parity checks appear after the collector runs for this property.
        </p>
        <p className="mt-3 text-xs text-muted">
          Nothing is wrong — there is simply nothing measured yet, and showing you zeros would be worse than
          showing you nothing.
        </p>
      </div>
    );
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: honest waiting state for a property with no collection yet"
```

---

## Task 18: Documentation and final verification

**Files:**
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: Update the README**

Replace the "Who can do what" section's opening to describe accounts: an account owns
properties and has one member list; roles apply within the account. Add a section
covering:

- there is no site password any more — magic link only, and **verifying a Resend domain
  is a prerequisite**, with `npm run signin -- <email>` as the break-glass path
- signup requires a code minted by `npm run signupcode -- "note"`
- the one-time migration: `npm run migrate` (dry run), then `npm run migrate -- --commit`
- that the collector now requires `ACCOUNT_ID` in its environment

Update the "Repo layout" line to mention `lib/accounts/`.

- [ ] **Step 2: Update .env.example**

Remove `SITE_PASSWORD` and `SESSION_SECRET` if unused. Add `ACCOUNT_ID` (collector) and
`OWNER_EMAIL` with a comment that it becomes the founding account owner during
migration.

- [ ] **Step 3: Full verification**

Run: `npm test`
Expected: PASS — all files

Run: `npx tsc --noEmit`
Expected: no output

Run: `npm run build`
Expected: PASS

Run: `grep -rn "DEFAULT_PROPERTY_ID\|SITE_PASSWORD\|lib/properties" --include="*.ts" --include="*.tsx" app lib components collector scripts`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: accounts, signup codes, migration and break-glass sign-in"
```

---

## Self-review (done at write time)

**Spec coverage:** account/property model (T1–2) · API keys per account (T3) · session
accountId and password removal (T4) · requirePropertyAccess with 404-not-403 (T5) ·
migration incl. named-key walk and lost notes (T6) · break-glass sign-in (T7) · seven
colliding keys scoped (T8) · route handlers (T9) · v1 API (T10) · pages and switcher
incl. phantom hotel deleted (T11) · registry deleted (T12) · structural tests incl.
raw-key ban (T13) · signup codes as distinct type (T14–15) · onboarding write path and
`/onboarding` behind auth (T16) · honest empty state (T17) · docs (T18). ✓

**Gap found and closed during the write:** the spec did not say how `/api/ingest` —
authenticated by `INGEST_SECRET`, with no session — determines the account, and a
property id alone cannot identify one. Task 8 adds `accountId` to the bundle and to
`config/properties.json`, and rejects an unknown account/property at the route.

**Type consistency:** `Property`/`Account`/`Member`/`Listings` (T1) are used unchanged
in T2, T5, T6, T11, T16. `PropertyInput` (T2) is the argument type in T6 and T16.
`AccessResult` (T5) is consumed in T9. `canReadProperty(record, accountId, propertyId)`
(T3) is called with three arguments in T10. `loadSnapshot(accountId, propertyId)` (T11)
keeps that signature in T17. ✓

**Placeholder scan:** none — every step carries the code or the exact command. Task 4
Step 3 records a genuine unknown (whether NextAuth accepts an empty `providers` array
in the edge config) with the fallback to apply if it fails. ✓
