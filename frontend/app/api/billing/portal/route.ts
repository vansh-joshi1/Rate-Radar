import { NextResponse } from 'next/server';
import { requireRole } from '../../../../../backend/lib/auth/guard';
import { demoRefusal, demoSid, requestProperty } from '../../../../../backend/lib/demo/context';
import { getStore } from '../../../../../backend/lib/store';
import { accountFor } from '../../../../../backend/lib/billing/accounts';
import { stripe } from '../../../../../backend/lib/billing/stripe';

export const dynamic = 'force-dynamic';

/** POST → { url } of Stripe's Customer Portal: card, plan switch, cancel, invoices. Owner only, reachable while locked. */
export async function POST(req: Request) {
  if (await demoSid()) return demoRefusal('Billing is turned off in the demo.');
  const gate = await requireRole('owner', { allowLocked: true });
  if (!gate.ok) return gate.response;

  const client = stripe();
  if (!client) return NextResponse.json({ error: 'billing is not configured' }, { status: 503 });
  const account = await accountFor(getStore(), (await requestProperty()).id);
  if (!account.stripeCustomerId) return NextResponse.json({ error: 'no billing account yet' }, { status: 409 });

  try {
    const session = await client.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${new URL(req.url).origin}/settings#billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal failed:', err);
    return NextResponse.json({ error: "Couldn't reach Stripe, try again." }, { status: 502 });
  }
}
