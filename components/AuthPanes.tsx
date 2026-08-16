'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { RadarIcon } from './RadarMark';

/*
 * Split-screen auth — same design language as the marketing landing (navy
 * radar surface, cobalt accent, Sora display type), fixed-light and
 * self-contained rather than reading the app tokens.
 *
 * The two tabs are two real routes (/login and /signup), not just UI state:
 * switching rewrites the path so links, the ?next= redirect, and Auth.js's
 * pages.signIn config all keep working. History is rewritten in place instead
 * of navigating so a half-typed email survives a tab switch.
 *
 * Only the auth that actually exists is on screen. There are exactly two ways
 * in (auth.ts): an invite-gated Resend magic link, and the shared site
 * password. No OAuth, no per-user password, no self-serve account creation —
 * so there is deliberately no Google button, no "forgot password", and no
 * "create password" field here.
 */

type Tab = 'signin' | 'signup';

/**
 * The post-login destination the middleware asked for, read once on mount.
 * Captured up front rather than re-read per use because switching tabs
 * rewrites the path — re-reading later would see the already-stripped URL and
 * silently drop the destination.
 *
 * Internal single-slash paths only: ?next must not become an open redirect.
 */
function readNextParam(): string {
  if (typeof window === 'undefined') return '';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/(?!\/)/.test(next) ? next : '';
}

const FIELD =
  'h-11 w-full rounded-lg border border-[#c4c6cd] bg-white px-4 text-[14px] text-[#1a1b20] outline-none transition-all placeholder:text-[#74777d] focus:border-[#085ac0] focus:ring-1 focus:ring-[#085ac0] disabled:opacity-60';

const LABEL =
  'mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1a1b20]';

const PRIMARY_BTN =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-[#085ac0] py-3.5 text-[13px] font-semibold tracking-wide text-white transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(11,28,48,0.18)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none';

const GHOST_BTN =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-[#c4c6cd] bg-white py-3.5 text-[13px] font-semibold tracking-wide text-[#1a1b20] transition-all hover:-translate-y-px hover:bg-[#f3f3fa] hover:shadow-[0_4px_12px_rgba(11,28,48,0.1)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none';

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
    <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
  </svg>
);

/* Left panel: the radar visual from the landing, not a stock hotel photo —
   it keeps the brand consistent and ships no third-party image request. */
function BrandPanel() {
  return (
    <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-[#0b1c30] lg:flex">
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #adc6ff 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#085ac0]/25 blur-[130px]" />
      </div>
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-[#085ac0]/25 opacity-30" />
        <span
          className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-[#085ac0]/35 opacity-40"
          style={{ animationDelay: '1.2s' }}
        />
      </div>

      <div className="relative z-10 max-w-md px-12 text-center">
        <Link href="/" className="mb-7 inline-flex items-center gap-2.5 text-white">
          <RadarIcon className="h-9 w-9 text-[#67dca8]" />
          <span className="font-display text-[32px] font-bold tracking-tight">Rate Radar</span>
        </Link>

        <p className="mb-10 text-[16px] leading-relaxed text-[#b7c7e2]">
          Demand-driven rate recommendations for independent hotels. Events, competitor prices, weather and
          holidays in — a nightly rate with its reasoning out.
        </p>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-left backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 shrink-0 rounded-full bg-[#085ac0] p-1.5 text-white">
              <SparkIcon />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-semibold text-white">Recommendation only</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#b7c7e2]">
                Rate Radar never changes a price on your site, your PMS, or any OTA. It shows its math and
                waits for you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPanes({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [nextPath] = useState(readNextParam);
  const redirectTo = nextPath || '/overview';

  const [linkState, setLinkState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [linkError, setLinkError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [joinState, setJoinState] = useState<'idle' | 'sending' | 'sent' | 'denied'>('idle');

  function selectTab(next: Tab) {
    setTab(next);
    // Keep the URL honest without a remount, so a half-typed email survives.
    // ?next= is re-attached from the captured value, not from the live URL,
    // which the previous tab switch may already have stripped.
    const signinPath = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    window.history.replaceState(null, '', next === 'signin' ? signinPath : '/signup');
  }

  async function submitMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLinkError('');
    setLinkState('sending');
    const email = new FormData(e.currentTarget).get('email');
    const res = await signIn('resend', { email, redirect: false, callbackUrl: redirectTo });
    if (res?.error) {
      setLinkError('Could not send the link — is this email on the team? Ask the owner for an invite.');
      setLinkState('idle');
    } else {
      setLinkState('sent');
    }
  }

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwBusy(true);
    setPwError('');
    const password = new FormData(e.currentTarget).get('password');
    const res = await signIn('site-password', { password, redirect: false });
    if (res?.error) {
      setPwError('Wrong password.');
      setPwBusy(false);
    } else {
      window.location.href = redirectTo;
    }
  }

  async function submitJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setJoinState('sending');
    const email = new FormData(e.currentTarget).get('email');
    const res = await signIn('resend', { email, redirect: false, callbackUrl: '/overview' });
    setJoinState(res?.error ? 'denied' : 'sent');
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md py-2.5 text-center text-[12px] font-semibold uppercase tracking-[0.06em] transition-all ${
      active ? 'bg-white text-[#085ac0] shadow-sm' : 'text-[#44474d] hover:text-[#1a1b20]'
    }`;

  return (
    <main className="flex min-h-screen bg-[#f8f9ff] font-inter text-[#1a1b20] antialiased">
      <BrandPanel />

      <div className="flex w-full items-center justify-center overflow-y-auto bg-[#f9f9ff] p-6 lg:w-1/2">
        <div className="w-full max-w-md rounded-2xl border border-[#c4c6cd] bg-white p-8 shadow-[0_12px_24px_rgba(11,28,48,0.08)]">
          {/* mobile wordmark — the brand panel is desktop-only */}
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-[#0b1c30] lg:hidden">
            <RadarIcon className="h-7 w-7 text-[#085ac0]" />
            <span className="font-display text-[24px] font-bold tracking-tight">Rate Radar</span>
          </Link>

          <div className="mb-8 flex rounded-lg bg-[#e8e7ee] p-1" role="tablist">
            <button
              type="button"
              role="tab"
              id="tab-signin"
              aria-selected={tab === 'signin'}
              aria-controls="pane-signin"
              className={tabClass(tab === 'signin')}
              onClick={() => selectTab('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              id="tab-signup"
              aria-selected={tab === 'signup'}
              aria-controls="pane-signup"
              className={tabClass(tab === 'signup')}
              onClick={() => selectTab('signup')}
            >
              Get access
            </button>
          </div>

          {tab === 'signin' ? (
            <div id="pane-signin" role="tabpanel" aria-labelledby="tab-signin">
              <h2 className="font-display text-[24px] font-semibold tracking-tight text-[#0b1c30]">Welcome back</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#44474d]">
                Two ways in — a personal sign-in link, or the shared site password.
              </p>

              <form onSubmit={submitMagicLink} className="mt-7">
                <label className={LABEL} htmlFor="signin-email">Email address</label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@hotel.com"
                  className={FIELD}
                  disabled={linkState !== 'idle'}
                />
                <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={linkState !== 'idle'}>
                  {linkState === 'sending' ? 'Sending…' : linkState === 'sent' ? 'Link sent — check your inbox' : (
                    <>
                      Email me a sign-in link
                      <MailIcon />
                    </>
                  )}
                </button>
                {linkError && <p className="mt-3 text-[13px] font-medium text-[#ba1a1a]">{linkError}</p>}
              </form>

              <div className="my-7 flex items-center gap-4">
                <span className="h-px flex-grow bg-[#c4c6cd]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#74777d]">Or</span>
                <span className="h-px flex-grow bg-[#c4c6cd]" />
              </div>

              <form onSubmit={submitPassword}>
                <label className={LABEL} htmlFor="signin-password">Shared site password</label>
                <input
                  id="signin-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={FIELD}
                  disabled={pwBusy}
                />
                <button type="submit" className={`${GHOST_BTN} mt-4`} disabled={pwBusy}>
                  {pwBusy ? 'Signing in…' : (
                    <>
                      Sign in with password
                      <ArrowIcon />
                    </>
                  )}
                </button>
                {pwError && <p className="mt-3 text-[13px] font-medium text-[#ba1a1a]">{pwError}</p>}
              </form>

              <p className="mt-7 text-center text-[13px] text-[#44474d]">
                Need access?{' '}
                <button type="button" onClick={() => selectTab('signup')} className="font-semibold text-[#085ac0] hover:underline">
                  Request an invite
                </button>
              </p>
            </div>
          ) : (
            <div id="pane-signup" role="tabpanel" aria-labelledby="tab-signup">
              <h2 className="font-display text-[24px] font-semibold tracking-tight text-[#0b1c30]">Get access</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#44474d]">
                Rate Radar accounts are invite-based — this is a real property’s revenue data. The owner adds
                teammates in Settings → Team. Already invited? Enter your email and we’ll send a sign-in link.
              </p>

              <form onSubmit={submitJoin} className="mt-7">
                <label className={LABEL} htmlFor="signup-email">Work email</label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@hotel.com"
                  className={FIELD}
                  disabled={joinState === 'sending' || joinState === 'sent'}
                />
                <button
                  type="submit"
                  className={`${PRIMARY_BTN} mt-4`}
                  disabled={joinState === 'sending' || joinState === 'sent'}
                >
                  {joinState === 'sending' ? 'Checking…' : joinState === 'sent' ? 'Link sent — check your inbox' : (
                    <>
                      Send my sign-in link
                      <MailIcon />
                    </>
                  )}
                </button>
              </form>

              {joinState === 'denied' && (
                <p className="mt-4 rounded-lg border border-[#ffdad6] bg-[#ffdad6]/40 px-4 py-3 text-[13px] font-medium leading-relaxed text-[#93000a]">
                  That email isn’t on the team yet — ask the property owner to invite you (Settings → Team).
                </p>
              )}

              <p className="mt-7 text-center text-[13px] text-[#44474d]">
                Already have access?{' '}
                <button type="button" onClick={() => selectTab('signin')} className="font-semibold text-[#085ac0] hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
