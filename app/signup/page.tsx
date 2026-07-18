'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

/**
 * Access is invite-gated (this is a real hotel's revenue data): the owner
 * adds teammates in Settings → Team; anyone invited signs in here with a
 * magic link. Uninvited emails get an honest explanation, not an account.
 */
export default function Signup() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'denied'>('idle');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    const email = new FormData(e.currentTarget).get('email');
    const res = await signIn('resend', { email, redirect: false, callbackUrl: '/overview' });
    setState(res?.error ? 'denied' : 'sent');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-5 text-ink">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          Rate Radar
        </Link>
        <div className="card p-8">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Get access</h2>
          <p className="mb-6 text-sm text-muted">
            Rate Radar accounts are invite-based — the property owner adds teammates in Settings → Team. Invited?
            Enter your email and we&apos;ll send a sign-in link.
          </p>
          <form onSubmit={submit}>
            <div className="mb-4">
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className="field" placeholder="you@hotel.com" required />
            </div>
            <button type="submit" className="btn btn-primary w-full py-3" disabled={state === 'sending' || state === 'sent'}>
              {state === 'sending' ? 'Checking…' : state === 'sent' ? 'Link sent — check your inbox' : 'Send my sign-in link'}
            </button>
          </form>
          {state === 'denied' && (
            <p className="mt-4 text-sm font-medium text-warn">
              That email isn&apos;t on the team yet — ask the property owner to invite you (Settings → Team).
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have access? <Link href="/login" className="font-semibold text-accent">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
