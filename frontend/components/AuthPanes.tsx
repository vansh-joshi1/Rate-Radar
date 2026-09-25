'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple';
import { EyeIcon } from '@phosphor-icons/react/dist/ssr/Eye';
import { EyeSlashIcon } from '@phosphor-icons/react/dist/ssr/EyeSlash';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle';
import { RadarIcon } from './RadarMark';
import { Bezel, PillButton, SPRING } from './landing/Machined';
import { DOT_FIELD, Grain, HeroRadar } from './landing/Backdrop';

/*
 * Sign in and Get access, on the marketing surface's machined parts
 * (DESIGN.md → Marketing surface). Fixed-light, literal hex, like the landing.
 *
 * Left: the form, open on the canvas. Right (lg and up): the range rings with
 * their sweep, and one Bezel holding a reading from the demo world, the same
 * figures the landing shows, so the visitor sees what is behind the door. It
 * keeps the rejected line dimmed on screen, which is the product's signature.
 *
 * The two tabs are two real routes (/login and /signup), not just UI state:
 * switching rewrites the path so links, the ?next= redirect, and Auth.js's
 * pages.signIn config all keep working. History is rewritten in place instead
 * of navigating so a half-typed email survives a tab switch.
 *
 * Only the auth that actually exists is on screen. There are exactly two ways
 * in (auth.ts): an invite-gated Resend magic link, and the shared site
 * password. No OAuth, no per-user password, no self-serve account creation,
 * so there is deliberately no Google button, no "forgot password", and no
 * "create password" field here. Get access takes the hotel email and hands
 * off to the /onboarding walkthrough, which creates nothing yet.
 *
 * Refusals (not on the team, wrong password) are honest states, not breakage,
 * so they take State Warn, never State Bad (The Warn-Not-Fail Rule).
 */

type Tab = 'signin' | 'signup';
type Sent = { email: string } | null;

/**
 * The post-login destination the middleware asked for, read once on mount.
 * Captured up front rather than re-read per use because switching tabs
 * rewrites the path: re-reading later would see the already-stripped URL and
 * silently drop the destination.
 *
 * Internal single-slash paths only: ?next must not become an open redirect.
 */
function readNextParam(): string {
  if (typeof window === 'undefined') return '';
  const next = new URLSearchParams(window.location.search).get('next');
  // Browsers read `/\host` as `//host`, so both slashes must be refused.
  return next && /^\/(?![/\\])/.test(next) ? next : '';
}

export const ring =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]';

export const FIELD = `h-12 w-full rounded-full bg-white px-5 text-[15px] text-[#1a1b20] shadow-[inset_0_1px_2px_rgba(11,28,48,0.06)] ring-1 ring-[#0b1c30]/[0.12] outline-none transition-shadow duration-300 placeholder:text-[#6b6e75] hover:ring-[#0b1c30]/20 focus:ring-2 focus:ring-[#085ac0]/60 disabled:opacity-60 aria-[invalid=true]:ring-[#b45309]/60`;

export const LABEL = 'mb-2 block pl-5 text-[14px] font-medium text-[#0b1c30]';

const textLink = `rounded-full font-medium text-[#0b1c30] underline decoration-[#0b1c30]/20 underline-offset-4 transition-colors duration-300 hover:decoration-[#0b1c30]/60 ${ring}`;

// ---------------------------------------------------------------- readout

// Same demo-world figures as the landing's reasoning preview (app/page.tsx).
const REASONS: { text: string; delta: string; rejected?: boolean }[] = [
  { text: 'Saturday baseline', delta: '$84' },
  { text: 'Cascadia State vs. Ridgeline, meaningful', delta: '+9%' },
  { text: 'Compset median $99', delta: 'no cap' },
  { text: 'Harbor Run 5K, score 8', delta: 'Too small to matter', rejected: true },
];

function Readout() {
  return (
    <div className="auth-rise w-full max-w-[440px]">
      <Bezel core="p-7 xl:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-geist-mono text-[12px] text-[#44474d]">Saturday, Standard</div>
            <div className="mt-2 text-[56px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0]">
              $92
            </div>
          </div>
          <div className="text-right font-geist-mono text-[13px] tabular-nums text-[#44474d]">
            <div>$88 to $96</div>
            <div className="text-[#029768]">+10% vs baseline</div>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-[#0b1c30]/[0.06]">
          {REASONS.map((r) => (
            <li key={r.text} className="flex items-baseline justify-between gap-4 py-3 text-[14px] leading-snug">
              <span className={`flex min-w-0 gap-3 ${r.rejected ? 'text-[#44474d]' : 'text-[#1a1b20]'}`}>
                <span aria-hidden className={r.rejected ? 'text-[#0b1c30]/25' : 'text-[#085ac0]'}>
                  •
                </span>
                {r.text}
              </span>
              {r.rejected ? (
                <span className="shrink-0 rounded-full bg-[#0b1c30]/[0.05] px-2.5 py-0.5 text-[12px] font-medium text-[#44474d]">
                  {r.delta}
                </span>
              ) : (
                <span className="shrink-0 font-geist-mono text-[13px] tabular-nums">{r.delta}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-[#0b1c30]/[0.06] pt-4">
          <span className="font-geist-mono text-[12px] text-[#44474d]">Confidence</span>
          <span className="text-[15px] font-semibold tabular-nums text-[#1a1b20]">68%</span>
        </div>
      </Bezel>

      <p className="mt-8 max-w-[40ch] text-pretty pl-2 text-[15px] leading-relaxed text-[#44474d]">
        Every night ahead gets a recommended rate and the reasons behind it. You decide what to charge.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Heading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[40px]">
        {title}
      </h1>
      <p className="mt-3 max-w-[44ch] text-pretty text-[15.5px] leading-relaxed text-[#44474d]">{children}</p>
    </>
  );
}

/** A refusal or failure, directly under the field it belongs to. */
function FieldNote({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-2.5 pl-5 text-[13.5px] font-medium leading-relaxed text-[#b45309]">
      {children}
    </p>
  );
}

/** The success state that replaces an email form once the link is out. */
function Inbox({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="auth-settle mt-7 rounded-[1.25rem] bg-[#029768]/[0.06] p-5 ring-1 ring-[#029768]/15">
      <div className="flex gap-3">
        <CheckCircleIcon weight="fill" aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#029768]" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#0b1c30]">Check your inbox</p>
          <p className="mt-1 text-pretty text-[14px] leading-relaxed text-[#44474d]">
            We sent a sign-in link to <span className="break-all font-medium text-[#1a1b20]">{email}</span>. Open
            it to sign in.
          </p>
          <button type="button" onClick={onReset} className={`mt-3 text-[14px] ${textLink}`}>
            Use a different email
          </button>
        </div>
      </div>
    </div>
  );
}

function Tabs({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const signinRef = useRef<HTMLButtonElement>(null);
  const signupRef = useRef<HTMLButtonElement>(null);

  // Arrow keys move between tabs, as a tablist should.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: Tab =
      e.key === 'Home' ? 'signin' : e.key === 'End' ? 'signup' : tab === 'signin' ? 'signup' : 'signin';
    onSelect(next);
    (next === 'signin' ? signinRef : signupRef).current?.focus();
  }

  const tabClass = (active: boolean) =>
    `relative z-10 rounded-full py-2 text-[14px] font-medium transition-colors duration-300 ${ring} ${
      active ? 'text-[#0b1c30]' : 'text-[#44474d] hover:text-[#0b1c30]'
    }`;

  return (
    <div
      role="tablist"
      aria-label="Sign in or get access"
      onKeyDown={onKeyDown}
      className="relative grid w-full max-w-[280px] grid-cols-2 rounded-full bg-[#0b1c30]/[0.05] p-1"
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_1px_2px_rgba(11,28,48,0.08),0_4px_12px_-4px_rgba(11,28,48,0.12)] ring-1 ring-[#0b1c30]/[0.06] transition-transform duration-500 ${SPRING} motion-reduce:transition-none ${
          tab === 'signup' ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      <button
        ref={signinRef}
        type="button"
        role="tab"
        id="tab-signin"
        aria-selected={tab === 'signin'}
        aria-controls="pane-signin"
        tabIndex={tab === 'signin' ? 0 : -1}
        className={tabClass(tab === 'signin')}
        onClick={() => onSelect('signin')}
      >
        Sign in
      </button>
      <button
        ref={signupRef}
        type="button"
        role="tab"
        id="tab-signup"
        aria-selected={tab === 'signup'}
        aria-controls="pane-signup"
        tabIndex={tab === 'signup' ? 0 : -1}
        className={tabClass(tab === 'signup')}
        onClick={() => onSelect('signup')}
      >
        Get access
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function AuthPanes({ initialTab }: { initialTab: Tab }) {
  const uid = useId();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [nextPath] = useState(readNextParam);
  const redirectTo = nextPath || '/overview';

  const [linkBusy, setLinkBusy] = useState(false);
  const [linkSent, setLinkSent] = useState<Sent>(null);
  const [linkError, setLinkError] = useState('');

  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwShown, setPwShown] = useState(false);


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
    setLinkBusy(true);
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    const res = await fetch('/api/auth/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, next: redirectTo }) }).catch(() => null);
    setLinkBusy(false);
    if (!res?.ok) {
      setLinkError('We could not send a link to that address. If you are not on the team yet, ask the owner for an invite.');
    } else {
      setLinkSent({ email });
    }
  }

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwBusy(true);
    setPwError('');
    const password = new FormData(e.currentTarget).get('password');
    const res = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null);
    if (!res?.ok) {
      setPwError(res?.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'That password is not right. Check with the property owner.');
      setPwBusy(false);
    } else {
      window.location.href = redirectTo;
    }
  }

  // The hotel email rides to /onboarding in sessionStorage, not the URL, so it
  // stays out of history and server logs. Onboarding still persists nothing.
  function startOnboarding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    try {
      sessionStorage.setItem('onboarding-email', email);
    } catch {}
    router.push('/onboarding');
  }

  const ids = {
    linkEmail: `${uid}-link-email`,
    linkNote: `${uid}-link-note`,
    pw: `${uid}-pw`,
    pwNote: `${uid}-pw-note`,
    joinEmail: `${uid}-join-email`,
  };

  return (
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} relative isolate grid min-h-[100dvh] grid-cols-1 bg-[#f8f9ff] font-geist text-[#1a1b20] antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}
      style={DOT_FIELD}
    >
      <Grain />

      <section className="flex min-w-0 flex-col px-4 pb-8 pt-6 md:px-6 lg:px-12 xl:px-20">
        <div>
          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-full bg-white/70 py-2 pl-4 pr-5 ring-1 ring-[#0b1c30]/[0.06] ${ring}`}
          >
            <RadarIcon className="h-5 w-5 text-[#085ac0]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10 md:py-12">
          <div className="mx-auto w-full max-w-[420px] lg:mx-0">
            <Tabs tab={tab} onSelect={selectTab} />

            {tab === 'signin' ? (
              <div key="signin" id="pane-signin" role="tabpanel" aria-labelledby="tab-signin" className="auth-settle mt-8">
                <Heading title="Welcome back">
                  Get a one-time link by email, or use your property&rsquo;s shared password.
                </Heading>

                {linkSent ? (
                  <Inbox email={linkSent.email} onReset={() => setLinkSent(null)} />
                ) : (
                  <form onSubmit={submitMagicLink} className="mt-7">
                    <label className={LABEL} htmlFor={ids.linkEmail}>
                      Email
                    </label>
                    <input
                      id={ids.linkEmail}
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@yourhotel.com"
                      className={FIELD}
                      disabled={linkBusy}
                      aria-invalid={linkError ? true : undefined}
                      aria-describedby={linkError ? ids.linkNote : undefined}
                    />
                    <div aria-live="polite">{linkError && <FieldNote id={ids.linkNote}>{linkError}</FieldNote>}</div>
                    <PillButton
                      type="submit"
                      className="mt-4 w-full"
                      disabled={linkBusy}
                      icon={<EnvelopeSimpleIcon weight="light" className="h-4 w-4" />}
                    >
                      {linkBusy ? 'Sending link…' : 'Email me a link'}
                    </PillButton>
                  </form>
                )}

                <div className="my-6 flex items-center gap-4" aria-hidden>
                  <span className="h-px flex-1 bg-[#0b1c30]/[0.08]" />
                  <span className="text-[13px] text-[#44474d]">or</span>
                  <span className="h-px flex-1 bg-[#0b1c30]/[0.08]" />
                </div>

                <form onSubmit={submitPassword}>
                  <label className={LABEL} htmlFor={ids.pw}>
                    Shared password
                  </label>
                  <div className="relative">
                    <input
                      id={ids.pw}
                      name="password"
                      type={pwShown ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      className={`${FIELD} pr-14`}
                      disabled={pwBusy}
                      aria-invalid={pwError ? true : undefined}
                      aria-describedby={pwError ? ids.pwNote : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setPwShown((s) => !s)}
                      aria-label={pwShown ? 'Hide password' : 'Show password'}
                      aria-pressed={pwShown}
                      className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#44474d] transition-colors duration-300 hover:bg-[#0b1c30]/[0.05] hover:text-[#0b1c30] ${ring}`}
                    >
                      {pwShown ? (
                        <EyeSlashIcon weight="light" className="h-[18px] w-[18px]" aria-hidden />
                      ) : (
                        <EyeIcon weight="light" className="h-[18px] w-[18px]" aria-hidden />
                      )}
                    </button>
                  </div>
                  <div aria-live="polite">{pwError && <FieldNote id={ids.pwNote}>{pwError}</FieldNote>}</div>
                  <PillButton type="submit" variant="secondary" className="mt-4 w-full" disabled={pwBusy}>
                    {pwBusy ? 'Signing in…' : 'Sign in with password'}
                  </PillButton>
                </form>
              </div>
            ) : (
              <div key="signup" id="pane-signup" role="tabpanel" aria-labelledby="tab-signup" className="auth-settle mt-8">
                <Heading title="Set up your hotel">
                  Start with your hotel&rsquo;s email. We&rsquo;ll walk you through the property, your listings and
                  your compset.
                </Heading>

                <form onSubmit={startOnboarding} className="mt-7">
                  <label className={LABEL} htmlFor={ids.joinEmail}>
                    Hotel email
                  </label>
                  <input
                    id={ids.joinEmail}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="gm@yourhotel.com"
                    className={FIELD}
                  />
                  <PillButton type="submit" className="mt-4 w-full">
                    Start onboarding
                  </PillButton>
                </form>

                <p className="mt-8 text-[14px] text-[#44474d]">
                  Just looking?{' '}
                  <Link href="/demo" className={textLink}>
                    Open the demo
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[13px] text-[#44474d]">Recommendation only. Rate Radar never changes a price anywhere.</p>
      </section>

      <aside aria-hidden className="relative isolate hidden min-w-0 items-center justify-center overflow-hidden px-12 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:self-start">
        <HeroRadar variant="auth" />
        <Readout />
      </aside>
    </main>
  );
}
