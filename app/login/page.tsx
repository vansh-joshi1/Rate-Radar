'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get('password');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      // Return to the page they were originally headed to; internal paths only
      // (must start with exactly one "/") so ?next can't become an open redirect.
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && /^\/(?!\/)/.test(next) ? next : '/overview';
    } else {
      setError('Wrong password.');
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
          <form onSubmit={submit}>
            <div className="mb-4">
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className="field" placeholder="you@hotel.com" />
            </div>
            <div className="mb-5">
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="field" autoFocus required />
            </div>
            <button type="submit" className="btn btn-primary w-full py-3">Sign in</button>
            {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
          </form>
          <div className="relative my-6 text-center">
            <hr className="border-line" />
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-card px-3 text-xs font-medium text-muted">OR</span>
          </div>
          <button className="btn w-full py-3" title="Coming soon" disabled>
            Email me a magic link (soon)
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account? <Link href="/signup" className="font-semibold text-accent">Create one</Link>
        </p>
      </div>
    </main>
  );
}
