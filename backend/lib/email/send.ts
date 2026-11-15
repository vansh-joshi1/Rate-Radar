import type { EmailMessage } from './messages';

/** One Resend call for every sender. Callers decide what a missing RESEND_API_KEY means. */
export async function sendEmail(msg: EmailMessage & { to: string | string[]; reply_to?: string }): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    // resend.dev only delivers to the Resend account owner; set EMAIL_FROM to an
    // address on a domain verified in Resend before real customers sign up.
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Rate Radar <onboarding@resend.dev>', ...msg }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
