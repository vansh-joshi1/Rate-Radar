'use client';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';
import { PillButton } from './landing/Machined';

/**
 * Consent for the optional trackers: PostHog analytics (every page) and
 * OriginID visitor identification (landing only). Neither loads until the
 * visitor accepts. Sign-in and demo cookies are strictly necessary and need no
 * consent (app/cookies). A Global Privacy Control signal counts as a
 * decline, so those visitors are never asked.
 */

export type Consent = 'granted' | 'denied';

const KEY = 'rr-consent';
const EVENT = 'rr-consent';

/** Nothing optional configured, nothing to ask about. */
const TRACKERS_ON = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_ORIGINID_PUBLIC_KEY);

/** Private windows can refuse storage; the choice then lasts for this page load. */
let memory: Consent | null = null;

function read(): Consent | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {}
  if (stored === 'granted' || stored === 'denied') return stored;
  if (memory) return memory;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ? 'denied' : null;
}

export function setConsent(c: Consent) {
  memory = c;
  try {
    localStorage.setItem(KEY, c);
  } catch {}
  // Declining also deletes what the trackers left, including cookies set before
  // this choice existed. ponytail: host-only cookies, which is what both set on our domain today.
  if (c === 'denied')
    for (const name of document.cookie.split('; ').map((kv) => kv.split('=')[0]))
      if (name.startsWith('ph_') || name === 'originid_vid') document.cookie = `${name}=; Max-Age=0; path=/`;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** 'unknown' on the server and during hydration, so nothing loads or flashes before the choice is read. */
export function useConsent(): Consent | null | 'unknown' {
  return useSyncExternalStore(subscribe, read, () => 'unknown');
}

const link =
  'font-medium text-[#0b1c30] underline decoration-[#0b1c30]/20 underline-offset-4 hover:decoration-[#0b1c30]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40';

/** Accept and Decline carry the same weight: declining must be as easy as accepting. */
function Choices() {
  return (
    <div className="flex flex-wrap gap-2">
      <PillButton type="button" variant="secondary" size="sm" icon={<CheckIcon className="h-3.5 w-3.5" />} onClick={() => setConsent('granted')}>
        Accept analytics
      </PillButton>
      <PillButton type="button" variant="secondary" size="sm" icon={<XIcon className="h-3.5 w-3.5" />} onClick={() => setConsent('denied')}>
        Decline
      </PillButton>
    </div>
  );
}

export default function CookieBanner() {
  const consent = useConsent();
  if (!TRACKERS_ON || consent !== null) return null;
  return (
    <section
      aria-label="Cookie choice"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[560px] rounded-[1.25rem] bg-white p-5 font-geist text-[#1a1b20] antialiased shadow-[0_8px_32px_-8px_rgba(11,28,48,0.25)] ring-1 ring-[#0b1c30]/[0.08]"
    >
      <p className="mb-4 text-pretty text-[14px] leading-relaxed text-[#44474d]">
        We&rsquo;d like to use analytics to see how Rate Radar is used. Sign-in cookies are always on; nothing else
        loads unless you accept.{' '}
        <Link href="/cookies" className={link}>
          Cookie policy
        </Link>
      </p>
      <Choices />
    </section>
  );
}

/** The cookie policy's control for changing an earlier choice. */
export function ConsentChoice() {
  const consent = useConsent();
  if (!TRACKERS_ON) return <p>No optional cookies are turned on for this site, so there is nothing to choose.</p>;
  return (
    <div className="mt-4 space-y-3">
      <p role="status" className="text-[14px] text-[#44474d]">
        {consent === 'granted'
          ? 'You accepted analytics.'
          : consent === 'denied'
            ? 'You declined analytics.'
            : consent === null
              ? 'You have not chosen yet.'
              : ''}
      </p>
      <Choices />
    </div>
  );
}
