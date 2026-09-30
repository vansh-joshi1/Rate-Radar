import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { ContactEmail } from '../../components/Legal';
import { textLink } from '../../components/landing/Machined';
import { TRIAL_DAYS } from '../../../backend/lib/billing/accounts';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="30 September 2026">
      <p>
        These terms govern your use of Rate Radar. By requesting access, signing in or subscribing you agree to them. If
        you use Rate Radar for a hotel, you confirm you may accept these terms on its behalf.
      </p>

      <h2>What Rate Radar does, and does not do</h2>
      <p>
        Rate Radar <strong>recommends</strong> nightly rates and shows its reasoning. It never changes a price on any
        booking channel or system. You decide what to charge, and you are responsible for the prices you set.
      </p>
      <p>
        Recommendations are built from third-party data (competitor prices from Google Hotels, event listings, weather,
        holidays) that can be late, incomplete or wrong. We do not promise any level of occupancy or revenue.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>Access is by approval or invitation. We may decline any access request.</li>
        <li>
          Keep your password and sign-in links to yourself. A hotel that uses the shared front-desk password is responsible
          for everyone it gives it to.
        </li>
        <li>Owners decide who is on their hotel&rsquo;s team and in what role, and are responsible for their team&rsquo;s use.</li>
        <li>Tell us promptly at <ContactEmail /> if you think someone has signed in as you.</li>
      </ul>

      <h2>Trial, plans and billing</h2>
      <ul>
        <li>
          New hotels get a {TRIAL_DAYS}-day free trial. No card is needed, and you are not charged unless you choose a
          plan.
        </li>
        <li>
          Plans are billed monthly or yearly in advance through Stripe, at the price shown when you subscribe, plus any
          applicable tax. <strong>Subscriptions renew automatically</strong> until you cancel.
        </li>
        <li>
          Cancel any time in Settings › Billing › Manage billing. Cancelling stops the next renewal; you keep access until
          the end of the period you have paid for.
        </li>
        <li>We give at least 30 days&rsquo; notice by email before a price change applies to your subscription.</li>
        <li>
          If a trial ends or a subscription lapses, the dashboard locks. Your data is kept, and access returns when you
          subscribe.
        </li>
        <li>
          Refunds are covered by the{' '}
          <Link href="/refunds" className={textLink}>
            Refund Policy
          </Link>
          .
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don&rsquo;t:</p>
      <ul>
        <li>use Rate Radar for anything unlawful, or to see another hotel&rsquo;s data;</li>
        <li>try to get around sign-in, roles, rate limits or the demo&rsquo;s limits, or probe for vulnerabilities without our permission;</li>
        <li>share API keys, or use the API faster than its published limits;</li>
        <li>copy, resell or redistribute the service or its data, or use it to build a competing product;</li>
        <li>overload the service, or put malicious code or someone else&rsquo;s personal information into it.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        Your hotel&rsquo;s data stays yours. You let us store and process it only to run Rate Radar for you, as described
        in the{' '}
        <Link href="/privacy" className={textLink}>
          Privacy Policy
        </Link>
        . You can ask for a copy or for deletion when you leave. We may use aggregated figures that identify no hotel or
        person to run and improve the service.
      </p>

      <h2>Third-party services</h2>
      <p>
        Parts of Rate Radar depend on other providers (listed in the Privacy Policy). Their outages or changes can affect
        Rate Radar, and we are not responsible for their services.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep Rate Radar running, but it is provided without a guarantee of uptime. Data collection can skip a
        source or a run. We may change or remove features; if a change materially reduces what you pay for, you may cancel
        and get a pro-rata refund of the unused period.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        Rate Radar is provided &ldquo;as is&rdquo;. To the extent the law allows, we disclaim all implied warranties,
        including fitness for a particular purpose, and we are not liable for lost revenue, lost profit, or indirect or
        consequential loss, including loss from any rate you chose to set. Our total liability for any claim is limited to
        what you paid us in the 12 months before it. Nothing here limits liability that cannot be limited by law.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Rate Radar at any time. We may suspend or close an account that breaks these terms or fails to
        pay, and we will tell you why unless the law prevents it.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. We email account owners at least 30 days before a material change takes effect.
        Continuing to use Rate Radar after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <ContactEmail />.
      </p>
    </LegalPage>
  );
}
