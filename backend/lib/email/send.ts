import type { EmailMessage } from './messages';

/** One Resend call for every sender. Callers decide what a missing RESEND_API_KEY means. */
export async function sendEmail(msg: EmailMessage & { to: string | string[] }): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Rate Radar <onboarding@resend.dev>', ...msg }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
