import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/Legal';
import { textLink } from '../../components/landing/Machined';
import { ConsentChoice } from '../../components/Consent';

export const metadata: Metadata = { title: 'Cookie Policy' };

type Row = { name: string; purpose: string; lasts: string };

const NECESSARY: Row[] = [
  {
    name: 'sb-…-auth-token',
    purpose: 'Keeps you signed in (Supabase).',
    lasts: 'Until you sign out, and never past 7 days (12 hours for the shared front-desk password)',
  },
  { name: 'rr_demo', purpose: 'Names your private demo sandbox.', lasts: '1 day' },
  { name: 'rr-consent (local storage)', purpose: 'Remembers your answer to the cookie question.', lasts: 'Until you clear it' },
  {
    name: 'onboarding-email (session storage)',
    purpose: 'Carries the email you typed on Get access into the onboarding form.',
    lasts: 'Until you close the tab',
  },
];

const OPTIONAL: Row[] = [
  {
    name: 'ph_…_posthog (cookie and local storage)',
    purpose: 'PostHog product analytics: which pages and features are used, and errors.',
    lasts: '1 year, or until you decline',
  },
  {
    name: 'originid_vid (front page only)',
    purpose:
      'DigitalFingerprint (OriginID) visitor identification: reads browser and device characteristics to recognise a returning visitor, and stores a visitor ID.',
    lasts: '1 year, or until you decline',
  },
];

function Table({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-[1rem] bg-white ring-1 ring-[#0b1c30]/[0.08]">
      <table className="w-full border-collapse text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[#0b1c30]/[0.08] text-[#0b1c30]">
            <th scope="col" className="px-4 py-3 font-semibold">Name</th>
            <th scope="col" className="px-4 py-3 font-semibold">What it does</th>
            <th scope="col" className="px-4 py-3 font-semibold">How long</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-[#0b1c30]/[0.06] align-top last:border-0">
              <td className="px-4 py-3 font-mono text-[12.5px] text-[#1a1b20]">{r.name}</td>
              <td className="px-4 py-3">{r.purpose}</td>
              <td className="px-4 py-3">{r.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cookies() {
  return (
    <LegalPage title="Cookie Policy" updated="30 September 2026">
      <p>
        Cookies and similar browser storage let a site remember things between pages. Rate Radar uses as few as it can.
        Anything not needed to sign you in or run the demo loads only after you accept analytics.
      </p>

      <h2>Your choice</h2>
      <ConsentChoice />
      <p>
        A browser that sends a Global Privacy Control signal is treated as having declined. Declining stops analytics and
        deletes the analytics cookies below.
      </p>

      <h2>Strictly necessary</h2>
      <p>These are always on: without them you could not sign in or use the demo. They are never used for tracking.</p>
      <Table caption="Strictly necessary cookies and storage" rows={NECESSARY} />

      <h2>Analytics, only with your consent</h2>
      <Table caption="Optional analytics cookies and storage" rows={OPTIONAL} />

      <h2>Other sites</h2>
      <p>
        Checkout and billing pages are hosted by Stripe on its own domain and use its own cookies. Our fonts are served
        from our own domain, so reading these pages sends nothing to a font provider.
      </p>
      <p>
        More on what we collect and why is in the{' '}
        <Link href="/privacy" className={textLink}>
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPage>
  );
}
