import type { Trigger } from './rules';
import { alertDigestEmail } from '../email/messages';
import { sendEmail } from '../email/send';

/**
 * Sends ONE digest email per run, regardless of how many triggers fired.
 * Free-tier Resend without a verified domain can only deliver to the Resend
 * account owner's address — set ALERT_EMAIL_TO accordingly (see README).
 *
 * @param recipients overrides ALERT_EMAIL_TO (an onboarded hotel's owners); an empty list skips the send.
 */
export async function sendAlertEmail(triggers: Trigger[], recipients?: string[]): Promise<'sent' | 'skipped'> {
  const key = process.env.RESEND_API_KEY;
  const to = recipients ? recipients.join(',') : process.env.ALERT_EMAIL_TO;
  if (!key || !to) {
    console.warn('[email] RESEND_API_KEY or ALERT_EMAIL_TO unset — alert email skipped. Triggers:', triggers.map((t) => t.line));
    return 'skipped';
  }
  await sendEmail({ to: to.split(',').map((s) => s.trim()), ...alertDigestEmail(triggers, process.env.DASHBOARD_URL) });
  return 'sent';
}
