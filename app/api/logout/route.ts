import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '../../../lib/auth';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return res;
}
