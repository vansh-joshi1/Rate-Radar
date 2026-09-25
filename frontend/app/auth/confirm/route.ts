import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { safeNext, verifyMagicLink } from '../../../../backend/auth';

/** Where the emailed magic link lands: trade the one-time token for session cookies. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  if (tokenHash && (await verifyMagicLink(tokenHash))) redirect(safeNext(req.nextUrl.searchParams.get('next')));
  redirect('/login?error=link');
}
