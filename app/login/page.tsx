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
    if (res.ok) window.location.href = '/overview';
    else setError('Wrong password.');
  }

  const field =
    'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#c8102e] focus:ring-2 focus:ring-[#c8102e]/20';

  return (
    <main className="font-inter flex min-h-screen items-center justify-center bg-[#f5f4f0] p-5 text-slate-900">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c8102e]" />
          Rate Radar
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Welcome back</h2>
          <form onSubmit={submit}>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className={field} placeholder="you@hotel.com" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className={field} autoFocus required />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#c8102e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#a00d25]"
            >
              Sign in
            </button>
            {error && <p className="mt-3 text-sm font-medium text-[#c8102e]">{error}</p>}
          </form>
          <div className="relative my-6 text-center">
            <hr className="border-slate-200" />
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-medium text-slate-400">OR</span>
          </div>
          <button
            className="w-full rounded-full border border-slate-300 py-3 text-[15px] font-semibold text-slate-400"
            title="Coming soon"
            disabled
          >
            Email me a magic link (soon)
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-[#c8102e]">Create one</Link>
        </p>
      </div>
    </main>
  );
}
