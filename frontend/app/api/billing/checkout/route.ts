import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '../../../../../backend/lib/auth/guard';
import { demoRefusal, demoSid, requestProperty } from '../../../../../backend/lib/demo/context';
import { getStore } from '../../../../../backend/lib/store';
import { accountFor, isExempt, saveAccount } from '../../../../../backend/lib/billing/accounts';
import { priceId, stripe } from '../../../../../backend/lib/billing/stripe';

export const dynamic = 'force-dynamic';

const Body = z.object({ plan: z.enum(['starter', 'growth']), interval: z.enum(['month', 'year']) });

/** Stripe won't start a subscription trial less than 48 hours out. */
const MIN_TRIAL_MS = 48 * 3_600_000 + 60_000;

/**
 * POST { plan, interval } → { url } of a Stripe Checkout page. Owner only, and
 * reachable while locked: this is how a lapsed hotel gets back in. Subscribing
 * mid-trial keeps the rest of the trial; billing starts when it would have ended.
 */
export async function POST(req: Request) {
  if (await demoSid()) return demoRefusal('Billing is turned off in the demo.');
  const gate = await requireRole('owner', { allowLocked: true });
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { plan, interval } = parsed.data;

  const client = stripe();
  const price = priceId(plan, interval);
  if (!client || !price) return NextResponse.json({ error: 'billing is not configured' }, { status: 503 });

  const property = await requestProperty();
  if (isExempt(property.id)) return NextResponse.json({ error: 'this hotel is not billed' }, { status: 409 });

  const store = getStore();
  const account = await accountFor(store, property.id);
  const origin = new URL(req.url).origin;
  try {
    if (!account.stripeCustomerId) {
      const customer = await client.customers.create({
        email: account.ownerEmail || undefined,
        name: property.name,
        metadata: { accountId: account.id },
      });
      account.stripeCustomerId = customer.id;
      await saveAccount(store, account);
    }
    const trialEnd = new Date(account.trialEndsAt).getTime();
    const keepTrial = !account.status && trialEnd - Date.now() > MIN_TRIAL_MS;
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: account.stripeCustomerId,
      client_reference_id: account.id,
      line_items: [{ price, quantity: 1 }],
      // The webhook finds the account from this; Stripe keeps it through portal changes.
      subscription_data: { metadata: { accountId: account.id }, ...(keepTrial ? { trial_end: Math.floor(trialEnd / 1000) } : {}) },
      success_url: `${origin}/settings?checkout=done#billing`,
      cancel_url: `${origin}/settings#billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout failed:', err);
    return NextResponse.json({ error: "Couldn't reach Stripe, try again." }, { status: 502 });
  }
}
