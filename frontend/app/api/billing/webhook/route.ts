import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStore } from '../../../../../backend/lib/store';
import { getAccount, LIVE_STATUSES, saveAccount } from '../../../../../backend/lib/billing/accounts';
import { accountFromSubscription, stripe } from '../../../../../backend/lib/billing/stripe';
import { enforceCompCap } from '../../../../../backend/lib/billing/limits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HANDLED = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']);

/**
 * Stripe → us. Authenticated by the signature, not a session. Every handled
 * event re-fetches the subscription and overwrites the account's billing
 * fields, so duplicate or out-of-order deliveries land on the same final state.
 */
export async function POST(req: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) return NextResponse.json({ error: 'billing is not configured' }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true });

  const sent = event.data.object as Stripe.Subscription;
  const store = getStore();
  const account = sent.metadata?.accountId ? await getAccount(store, sent.metadata.accountId) : null;
  if (!account) {
    // Retrying can't fix a subscription made outside our checkout.
    console.warn(`[billing] ${event.type} for ${sent.id} matches no account`);
    return NextResponse.json({ received: true });
  }

  try {
    const sub = await client.subscriptions.retrieve(sent.id);
    // After a cancel and re-subscribe, a late event for the old, dead subscription must not overwrite the new one.
    const stale = account.subscriptionId && account.subscriptionId !== sub.id && !LIVE_STATUSES.has(sub.status);
    if (stale) return NextResponse.json({ received: true });
    const updated = { ...account, ...accountFromSubscription(sub) };
    await saveAccount(store, updated);
    for (const propertyId of updated.propertyIds) await enforceCompCap(updated, propertyId);
  } catch (err) {
    // Unknown price (a missing env var) or Stripe unreachable: fail, so Stripe retries and the dashboard shows it.
    console.error(`[billing] ${event.type} for ${sent.id} failed:`, err);
    return NextResponse.json({ error: 'not applied' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
