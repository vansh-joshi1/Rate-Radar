'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  // internal single-slash paths only — ?next must not become an open redirect
  return next && /^\/(?!\/)/.test(next) ? next : '/overview';
}

export default function Login() {
  const [error, setError] = useState('');
  const [linkState, setLinkState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const password = new FormData(e.currentTarget).get('password');
    const res = await signIn('site-password', { password, redirect: false });
    if (res?.error) {
      setError('Wrong password.');
      setBusy(false);
    } else {
      window.location.href = safeNext();
    }
  }

  async function submitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLinkState('sending');
    const email = new FormData(e.currentTarget).get('email');
    const res = await signIn('resend', { email, redirect: false, callbackUrl: safeNext() });
    if (res?.error) {
      setError('Could not send the link — is this email on the team? Ask the owner for an invite.');
      setLinkState('idle');
    } else {
      setLinkState('sent');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-5 text-ink">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          Rate Radar
        </Link>
        <div className="card p-8">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Welcome back</h2>

          <form onSubmit={submitEmail}>
            <div className="mb-4">
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className="field" placeholder="you@hotel.com" required />
            </div>
            <button type="submit" className="btn btn-primary w-full py-3" disabled={linkState !== 'idle'}>
              {linkState === 'sending' ? 'Sending…' : linkState === 'sent' ? 'Link sent — check your inbox' : 'Email me a sign-in link'}
            </button>
          </form>

          <div className="relative my-6 text-center">
            <hr className="border-line" />
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-card px-3 text-xs font-medium text-muted">OR</span>
          </div>

          <form onSubmit={submitPassword}>
            <div className="mb-4">
              <label className="label" htmlFor="password">Site password</label>
              <input id="password" name="password" type="password" className="field" required />
            </div>
            <button type="submit" className="btn w-full py-3" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with password'}
            </button>
          </form>

          {error && <p className="mt-4 text-sm font-medium text-bad">{error}</p>}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Need access? <Link href="/signup" className="font-semibold text-accent">Request an invite</Link>
        </p>
      </div>
    </main>
  );
}
