import { Resend } from 'resend';
import type { Trigger } from './rules';
import { alertDigestEmail } from '../email/messages';

/**
 * Sends ONE digest email per run, regardless of how many triggers fired.
 * Free-tier Resend without a verified domain can only deliver to the Resend
 * account owner's address — set ALERT_EMAIL_TO accordingly (see README).
 */
export async function sendAlertEmail(triggers: Trigger[]): Promise<'sent' | 'skipped'> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!key || !to) {
    console.warn('[email] RESEND_API_KEY or ALERT_EMAIL_TO unset — alert email skipped. Triggers:', triggers.map((t) => t.line));
    return 'skipped';
  }
  const { subject, html, text } = alertDigestEmail(triggers, process.env.DASHBOARD_URL);

  const resend = new Resend(key);
  await resend.emails.send({
    from: 'Rate Radar <onboarding@resend.dev>',
    to: to.split(',').map((s) => s.trim()),
    subject,
    html,
    text,
  });
  return 'sent';
}
