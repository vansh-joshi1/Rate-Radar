import type { Metadata } from 'next';
import LegalPage, { ContactEmail } from '../../components/Legal';
import { TRIAL_DAYS } from '../../../backend/lib/billing/accounts';

export const metadata: Metadata = { title: 'Refund Policy' };

export default function Refunds() {
  return (
    <LegalPage title="Refund Policy" updated="30 September 2026">
      <h2>Try before you pay</h2>
      <p>
        Every hotel starts with a {TRIAL_DAYS}-day free trial with no card, so you can judge Rate Radar on your own
        property before paying anything. Nothing is charged unless you choose a plan.
      </p>

      <h2>Cancelling</h2>
      <p>
        Cancel any time in Settings → Billing → Manage billing. Your plan stops renewing, you are not charged again, and you
        keep access until the end of the period you have already paid for.
      </p>

      <h2>When we refund</h2>
      <ul>
        <li>
          <strong>Billing mistakes:</strong> a duplicate charge, a charge after you cancelled, or a wrong amount is refunded in
          full.
        </li>
        <li>
          <strong>Features we remove:</strong> if we materially reduce what your plan includes, you can cancel and get the
          unused part of the period back.
        </li>
        <li>
          <strong>Where the law requires it:</strong> nothing here takes away a refund right you have by law.
        </li>
      </ul>
      <p>
        Otherwise, payments are not refundable, including for the unused part of a month or year after you cancel.
      </p>

      <h2>How to ask</h2>
      <p>
        Email <ContactEmail /> with your hotel&rsquo;s name and the invoice date within 60 days of the charge. Approved
        refunds go back to the original card through Stripe and usually arrive in 5 to 10 business days.
      </p>
    </LegalPage>
  );
}
