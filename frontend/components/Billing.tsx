'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LockSimpleIcon } from '@phosphor-icons/react/dist/ssr/LockSimple';
import { Bezel, PillButton } from './landing/Machined';
import { StatusLine } from './settings/parts';
import { PLAN_LIMITS, PLAN_PRICES } from '../../backend/lib/billing/plans';
import { useCanWrite } from './RoleProvider';

/**
 * Billing controls. Both go to Stripe-hosted pages: Checkout to subscribe, the
 * Customer Portal for card, plan switch, cancel and invoices. Nothing here
 * handles card details.
 */

type Status = { tone: 'ok' | 'bad' | 'muted'; text: string } | null;

/** POST to a billing route and follow the Stripe URL it returns. */
async function goToStripe(path: string, body: unknown, setStatus: (s: Status) => void) {
  setStatus({ tone: 'muted', text: 'Opening Stripe…' });
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
    if (data.url) return window.location.assign(data.url);
    setStatus({ tone: 'bad', text: data.message ?? data.error ?? "Couldn't reach Stripe, try again." });
  } catch {
    setStatus({ tone: 'bad', text: "Couldn't reach Stripe, try again." });
  }
}

export function PlanPicker() {
  const [interval, setPeriod] = useState<'month' | 'year'>('month');
  const [status, setStatus] = useState<Status>(null);
  const busy = status?.tone === 'muted';
  return (
    <div className="space-y-5">
      <fieldset className="inline-flex gap-1 rounded-full bg-[#0b1c30]/[0.05] p-1">
        <legend className="sr-only">Billing period</legend>
        {(['month', 'year'] as const).map((i) => (
          <label
            key={i}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[14px] font-medium text-[#44474d] has-[:checked]:bg-white has-[:checked]:text-[#0b1c30] has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#085ac0]"
          >
            <input type="radio" name="bill-interval" className="sr-only" checked={interval === i} onChange={() => setPeriod(i)} />
            {i === 'month' ? 'Monthly' : 'Yearly, 2 months free'}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        {(['starter', 'growth'] as const).map((plan) => (
          <PillButton
            key={plan}
            variant={plan === 'growth' ? 'primary' : 'secondary'}
            disabled={busy}
            onClick={() => goToStripe('/api/billing/checkout', { plan, interval }, setStatus)}
          >
            {PLAN_PRICES[plan].name}, {PLAN_PRICES[plan][interval]} per {interval}
          </PillButton>
        ))}
      </div>
      <p className="text-[13px] text-[#44474d]">
        Renews every {interval} until you cancel in Manage billing. See the{' '}
        <Link href="/refunds" className="underline underline-offset-4">
          refund policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="underline underline-offset-4">
          terms
        </Link>
        .
      </p>
      <StatusLine status={status} />
    </div>
  );
}

export function ManageBilling() {
  const [status, setStatus] = useState<Status>(null);
  return (
    <div className="space-y-3">
      <PillButton variant="secondary" disabled={status?.tone === 'muted'} onClick={() => goToStripe('/api/billing/portal', {}, setStatus)}>
        Manage billing
      </PillButton>
      <StatusLine status={status} />
    </div>
  );
}

/** The Bellhop page on Starter. Starter means a Stripe customer exists, so the portal is where the owner switches plan. */
export function BellhopUpgrade() {
  const isOwner = useCanWrite('owner');
  return (
    <Bezel className="mx-auto mt-10 max-w-[640px]" core="space-y-6 p-8 md:p-10">
      <LockSimpleIcon weight="light" className="h-7 w-7 text-[#44474d]" aria-hidden />
      <div className="space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1c30]">Bellhop is on the Growth plan</h1>
        <p className="max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
          {isOwner
            ? `Growth adds Bellhop, ${PLAN_LIMITS.growth.maxComps} competitors and a year of history for ${PLAN_PRICES.growth.month} a month. Switch plans in billing.`
            : "Ask your hotel's owner to move to Growth. The recommendations and their reasoning are on the dashboard either way."}
        </p>
      </div>
      {isOwner && <ManageBilling />}
    </Bezel>
  );
}

/** Shown instead of every app page once a hotel's trial or subscription has lapsed. */
export function PlanWall({ isOwner, hasCustomer, hotel }: { isOwner: boolean; hasCustomer: boolean; hotel: string }) {
  return (
    <Bezel className="mx-auto mt-10 max-w-[640px]" core="space-y-6 p-8 md:p-10">
      <LockSimpleIcon weight="light" className="h-7 w-7 text-[#44474d]" aria-hidden />
      <div className="space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1c30]">Pick a plan to keep going</h1>
        <p className="max-w-[56ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
          {isOwner
            ? `${hotel}'s trial or subscription has ended. Your data is kept, and collection starts again on the next run after you subscribe.`
            : `${hotel}'s trial or subscription has ended. Ask your hotel's owner to pick a plan; everything is kept until they do.`}
        </p>
      </div>
      {isOwner && <PlanPicker />}
      {isOwner && hasCustomer && <ManageBilling />}
    </Bezel>
  );
}
