import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { ContactEmail } from '../../components/Legal';
import { textLink } from '../../components/landing/Machined';

export const metadata: Metadata = { title: 'Privacy Policy' };

/*
 * Every claim here is checked against the code. When what we collect or who
 * processes it changes, this page changes in the same pull request.
 */
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="30 September 2026">
      <p>
        Rate Radar recommends nightly room rates to hotels. This page says what personal information we collect, why,
        who else handles it, and what you can ask us to do with it. Questions go to <ContactEmail />.
      </p>

      <h2>What we collect</h2>
      <h3>When you request access</h3>
      <p>
        The onboarding form collects your hotel&rsquo;s name, address, phone number, room count and type, your listing
        links or booking channels, room types and prices, the competitors you pick, and the email and password you will
        sign in with. The password goes straight to our sign-in provider, which stores only a hash of it. We never see or
        keep it.
      </p>
      <h3>When you use Rate Radar</h3>
      <ul>
        <li>Your email address, your role (owner, manager or viewer), and which hotel you belong to.</li>
        <li>The email addresses of teammates an owner invites.</li>
        <li>What your team enters: baseline and current rates, rates achieved, rooms booked, notes and the competitor watchlist.</li>
        <li>Questions asked of Bellhop, the assistant on the Analytics page.</li>
        <li>Billing details: your plan, its status and renewal date, and the ID our payment processor gives your account. We never see or store card numbers.</li>
      </ul>
      <h3>Automatically</h3>
      <ul>
        <li>
          <strong>Always:</strong> your IP address, used to limit repeated sign-in and sign-up attempts. These counters are
          deleted within an hour. Our hosting provider also keeps standard request logs.
        </li>
        <li>
          <strong>Only if you accept analytics:</strong> the pages you visit, the features you use (for example
          &ldquo;baseline rates saved&rdquo;), errors, and your browser and device type. When you are signed in these are
          linked to your account ID and role, never to your name or email. On the front page only, a visitor-identification
          service also reads browser and device characteristics to recognise returning visitors. See the{' '}
          <Link href="/cookies" className={textLink}>
            Cookie Policy
          </Link>
          .
        </li>
      </ul>
      <p>
        The rest of what Rate Radar works with (competitor prices, local events, weather, holidays) is public information
        about hotels and places, not about people.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To review your access request and set up your hotel, which includes contacting you by email or phone.</li>
        <li>To sign you in, keep each hotel&rsquo;s data visible only to its own team, and enforce each person&rsquo;s role.</li>
        <li>To produce recommendations and send the alert emails and sign-in links you ask for.</li>
        <li>To bill your subscription.</li>
        <li>To protect the service from abuse.</li>
        <li>With your consent, to understand which parts of the product are used and fix what breaks.</li>
      </ul>
      <p>We do not sell personal information or share it for advertising.</p>

      <h2>Who else handles it</h2>
      <p>These providers process data on our behalf, only to run the parts of Rate Radar listed next to them:</p>
      <ul>
        <li><strong>Vercel</strong>: hosts the website and its servers.</li>
        <li><strong>Supabase</strong>: database and sign-in.</li>
        <li><strong>Resend</strong>: sends sign-in links and alert emails.</li>
        <li><strong>Stripe</strong>: takes payments and manages subscriptions, under its own privacy policy for card data.</li>
        <li>
          <strong>Google (Gemini)</strong>: answers Bellhop questions. Your question and your hotel&rsquo;s dashboard figures
          are sent with it, and some answers use Google Search. On the API tier we use, Google may use questions and
          answers to improve its products and may have people review them, so keep guests&rsquo; personal details out of
          your questions.
        </li>
        <li><strong>SerpApi</strong>: looks up your hotel on Google Hotels during onboarding, using its name and address.</li>
        <li><strong>OpenStreetMap services</strong> (Photon, Nominatim): place hotel names and addresses on the map.</li>
        <li><strong>PostHog</strong>: product analytics, only with your consent.</li>
        <li><strong>DigitalFingerprint (OriginID)</strong>: visitor identification on the front page, only with your consent.</li>
      </ul>
      <p>
        Some of these providers are in the United States, so your information may be processed there. We may also disclose
        information if the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and hotel data: for as long as your hotel uses Rate Radar, then deleted on request.</li>
        <li>Access requests: while under review and, once approved, as part of your hotel&rsquo;s account.</li>
        <li>A removed teammate&rsquo;s sign-in account is deleted when they are removed.</li>
        <li>Rate-limit counters: under an hour. Demo sandboxes: one day.</li>
        <li>Analytics: per PostHog&rsquo;s retention settings, and deleted from your browser if you decline.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <p>
        You can ask to see, correct, export or delete your personal information, or object to how we use it, by emailing{' '}
        <ContactEmail />. We answer within 30 days. You can accept or decline analytics at any time on the{' '}
        <Link href="/cookies" className={textLink}>
          Cookie Policy
        </Link>{' '}
        page, and we treat a browser&rsquo;s Global Privacy Control signal as a decline. Depending on where you live (for
        example the EU, the UK or California) you may have further rights, including complaining to your data protection
        authority. We will not treat you differently for using them.
      </p>

      <h2>Security</h2>
      <p>
        Data travels over HTTPS. Passwords are hashed by our sign-in provider, API keys are stored only as hashes, each
        hotel&rsquo;s data is scoped to its own team, and every change is checked against the person&rsquo;s role on our
        servers. Sign-ins expire after 7 days (12 hours for the shared front-desk password).
      </p>

      <h2>Children</h2>
      <p>Rate Radar is a business tool and is not meant for anyone under 16. We do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>
        When this policy changes we update the date at the top, and we email account owners before any change that affects
        how their information is used.
      </p>
    </LegalPage>
  );
}
