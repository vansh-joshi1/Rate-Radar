const COOKIE_PAYLOAD = 'rate-radar-authorized';
export const COOKIE_NAME = 'rr_session';

async function hmac(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? '';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sessionCookieValue(): Promise<string> {
  return hmac(COOKIE_PAYLOAD);
}

export async function verifySession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue || !process.env.SESSION_SECRET) return false;
  const expected = await hmac(COOKIE_PAYLOAD);
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
