import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ownerEmail } from '../../../../backend/lib/auth/members';
import { salesInquiryEmail } from '../../../../backend/lib/email/messages';
import { sendEmail } from '../../../../backend/lib/email/send';
import { getStore } from '../../../../backend/lib/store';

export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((p) => p.replace(/\D/g, '').length >= 10, 'phone needs at least 10 digits'),
  properties: z.coerce.number().int().min(1).max(10000),
  details: z.string().trim().max(2000),
});

/**
 * The Enterprise "Contact us" form on the landing page: emails the inquiry to
 * OWNER_EMAIL. Public, so it is throttled per IP like /api/onboarding/request.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if ((await getStore().incr(`contact:${ip}`, 3600)) > 5) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const to = ownerEmail();
  if (!to || !process.env.RESEND_API_KEY) {
    console.warn('[contact] OWNER_EMAIL or RESEND_API_KEY unset — inquiry not sent', parsed.data);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  // Reply-To is the visitor, so answering the inquiry is one click.
  await sendEmail({ to, reply_to: parsed.data.email, ...salesInquiryEmail(parsed.data) });
  return NextResponse.json({ ok: true });
}
