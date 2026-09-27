# Stripe billing — design

**Date:** 2026-09-27
**Status:** approved
**Scope:** project 1 of 3. Wires the Starter and Growth plans to Stripe, replaces the
placeholder Billing tab, and locks a hotel whose trial or subscription has lapsed.
Plan limits (project 2) and multi-hotel accounts (project 3) get their own specs.

## Why

The landing page sells three plans with a 14-day trial, but nothing takes money.
Settings → Billing shows a hardcoded "Starter, $99" and a fake "test card ending 4242",
and a hotel keeps full access forever whether or not it pays.

## The three projects

1. **Payments and the trial wall** (this spec). Checkout, portal, webhook, a real
   Billing tab, and a lock once the trial ends.
2. **Plan limits within one hotel.** Bellhop, twice-daily vs 4× daily refreshes, 8-comp
   cap, 90-day vs 13-month history, event-impact alerts. Each reads the plan this spec
   records.
3. **Multi-hotel accounts.** Up to 5 hotels on one Growth subscription, and the rollup
   dashboard. Attaches hotels to the account record this spec introduces.

## Decisions

| Decision | Choice |
|---|---|
| Provider | Stripe, hosted Checkout + hosted Customer Portal. No card form of our own; card data never touches our server. |
| What a subscription belongs to | An **account**, not a hotel. Today every account holds one hotel; project 3 adds more without reworking billing. |
| Plans sold | Starter and Growth, monthly or yearly: four Stripe prices. Prices are the owner's (PRODUCT.md, commercial model). Enterprise stays "Contact us" and is not in Stripe. |
| Trial | 14 days, no card, tracked by us (`trialEndsAt`), not a Stripe trial. It starts when an admin approves the hotel. |
| Hotels approved before this ships | Get an account on first lookup with a fresh 14-day trial from that moment. |
| Exempt | The original property (`DEFAULT_PROPERTY_ID`, the `OWNER_EMAIL` hotel) and the demo sandbox. Never billed, never locked. |
| Who manages billing | `owner` role only. Managers and viewers see the status, read-only. |
| Subscribing mid-trial | Checkout passes the remaining trial as `subscription_data.trial_end`, so billing starts when the trial would have ended. Stripe requires `trial_end` at least 48h out; under 48h left, the charge is immediate. |
| Failed payment | `past_due` keeps full access while Stripe retries the card (retry schedule is set in the Stripe dashboard). Locks on `unpaid` or `canceled`. |
| Lapsed hotel | Locked, collection paused. Data is kept; subscribing unlocks at once and collection resumes on the next run. |
| Invoice history | Not rendered by us. The portal shows it. |

## Data

`Account`, stored in the global store (`getStore()`, not a property-prefixed one):

```ts
interface Account {
  id: string;
  ownerEmail: string;
  propertyIds: string[];
  trialEndsAt: string;              // ISO
  stripeCustomerId?: string;
  subscriptionId?: string;
  plan?: 'starter' | 'growth';
  interval?: 'month' | 'year';
  status?: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing';
  currentPeriodEnd?: string;        // ISO
  cancelAtPeriodEnd?: boolean;
}
```

- `accounts` hash: account id → `Account`.
- `account:byProperty` hash: property id → account id.

`status` mirrors Stripe's subscription status. It is absent until the account first
subscribes; until then only `trialEndsAt` decides access.

## Access

One pure function, `access(account, propertyId, now): 'open' | 'locked'`.

Open when any of:
- the property is exempt;
- `status` is `active`, `trialing` or `past_due`;
- no `status` (never subscribed) and `now < trialEndsAt`.

Locked otherwise, including `canceled`, `unpaid`, `incomplete` and
`incomplete_expired`. A subscription cancelled "at period end" stays `active` until the
period ends, so it stays open until then.

It is enforced in three places:

1. **`frontend/app/(app)/layout.tsx`** renders `<PlanWall>` instead of the page when
   locked. Owners see Starter and Growth with a monthly/yearly toggle and a Subscribe
   button per plan, plus "Manage billing" when a Stripe customer exists (to fix a card).
   Others see "Your trial has ended. Ask your hotel's owner to pick a plan."
2. **`requireRole()`** in `backend/lib/auth/guard.ts` returns 402 `{ error: 'plan required' }`
   when locked. Every gated API route already calls it, so Bellhop, manual runs and edits
   stop in one place. The billing routes pass `{ allowLocked: true }`.
3. **`/api/ingest/properties`** leaves locked hotels out, so the collector spends no
   SerpApi searches on them.

## Components

| File | Responsibility |
|---|---|
| `backend/lib/billing/accounts.ts` | `Account` type, `accountFor(propertyId)` (creates the account with a fresh trial when missing), `saveAccount`, `access()`, `trialDaysLeft()`. |
| `backend/lib/billing/stripe.ts` | The only file importing the `stripe` SDK. Client from `STRIPE_SECRET_KEY`; plan ↔ price-id map from the four price env vars; `accountFromSubscription(sub)` turning a Stripe subscription into the `Account` fields above. |
| `frontend/app/api/admin/approve/route.ts` | Creates the approved hotel's account (`trialEndsAt` = now + 14 days) beside `addProperty`. |
| `frontend/app/api/billing/checkout/route.ts` | POST `{ plan, interval }`, zod-validated. `requireRole('owner', { allowLocked: true })`. Creates the Stripe customer on first use (saved on the account), then a Checkout Session in `subscription` mode with `client_reference_id` = account id and the trial carry-over above. Returns `{ url }`. Refuses exempt properties and demo callers. |
| `frontend/app/api/billing/portal/route.ts` | POST. `requireRole('owner', { allowLocked: true })`. Returns a Customer Portal session `{ url }`, return URL `/settings#billing`. 409 when the account has no Stripe customer. |
| `frontend/app/api/billing/webhook/route.ts` | Not behind auth. Verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET` using the raw body. Handles `checkout.session.completed` (links subscription to the account via `client_reference_id`) and `customer.subscription.created/updated/deleted`. Each event re-fetches the subscription from Stripe and overwrites the account's billing fields, so duplicate or out-of-order events land on the same final state. Node runtime. |
| `frontend/components/PlanWall.tsx` | The locked screen described above. |
| `frontend/components/SettingsView.tsx` | Billing tab reads the account: plan and interval with its price, status ("Trial, 9 days left", "Active, renews 12 Nov", "Cancels 12 Nov", "Payment failed, Stripe is retrying"), and a Manage billing button (owner, when a customer exists) or plan buttons (owner, still on trial). Drops the fake card and the invoice list. Demo keeps its sample figures. Exempt property shows "Not billed". |

## Environment

Vercel only, server-only (none are `NEXT_PUBLIC_`), added to `frontend/.env.example`
and `docs/SETUP.md`:

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_MONTHLY`,
`STRIPE_PRICE_STARTER_YEARLY`, `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_YEARLY`.

Stripe dashboard setup (documented in SETUP.md): two products, four prices matching
PRODUCT.md, the Customer Portal enabled with plan switching between the four prices,
and a webhook endpoint for the four events above.

With `STRIPE_SECRET_KEY` unset (local demo), billing routes return 503 and the wall
still applies, so the lock can be tested without Stripe.

## Failure handling

- Webhook signature missing or wrong: 400, nothing written.
- Webhook for a price id not in the map: 500 and a logged error, so Stripe retries and
  the delivery shows as failing in the dashboard until the env var is fixed.
- Webhook for a subscription whose account can't be found: 200 and a logged warning
  (retrying cannot fix it).
- Stripe unreachable during checkout or portal: 502; the button shows "Couldn't reach
  Stripe, try again."
- Returning from Checkout before the webhook lands: the success URL
  (`/settings?checkout=done#billing`) shows "Payment received, updating your plan…"
  and refreshes once after a few seconds.

## Testing

- Vitest: `access()` across every status, trial boundary and exemption.
- Vitest: `accountFromSubscription()` against saved Stripe subscription payloads
  (monthly/yearly, both plans, cancel-at-period-end, unknown price throws).
- Vitest: webhook route rejects a bad signature and ignores unhandled event types.
- Manual, once: Stripe test keys + `stripe listen --forward-to localhost:3000/api/billing/webhook`
  — subscribe mid-trial, cancel in the portal, fail a payment with test card
  `4000 0000 0000 0341`, confirm lock and unlock.

## Out of scope

- Enterprise checkout and where Enterprise enquiries go.
- Plan limits (project 2) and multi-hotel accounts and rollup (project 3).
- Proration rules beyond Stripe's defaults, coupons, tax collection.
- Emails of our own about billing; Stripe's receipt and failed-payment emails are
  turned on in its dashboard instead.
