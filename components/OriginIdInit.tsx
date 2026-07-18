'use client';
import Script from 'next/script';

/**
 * DigitalFingerprint (OriginID) visitor identification — official CDN
 * script-tag integration. Mounted on the public landing page ONLY (owner
 * request) — signed-in app pages are not fingerprinted.
 *
 * Script: the vendor CDN build, SRI-pinned (hash verified against the served
 * file 2026-07-18). NEXT_PUBLIC_ORIGINID_SCRIPT_URL overrides the source
 * (e.g. self-hosted first-party proxy) — integrity is skipped then, since the
 * pin belongs to the CDN artifact. Renders nothing until the public key is
 * set. Public keys are browser-visible by design (pk_… — platform-managed
 * integrity + hostname allowlisting); the secret sk_… key is server-only and
 * never appears here.
 *
 * Docs: https://docs.digitalfingerprintjs.com/#quickstart
 */

interface OriginIdResult {
  originId: string;
  eventId: string;
}

declare global {
  interface Window {
    OriginID?: {
      init(config: {
        endpoint: string;
        apiKey: string;
        onIdentify?: (result: OriginIdResult) => void;
      }): { ready(): Promise<OriginIdResult> };
    };
  }
}

const ENDPOINT = 'https://api.digitalfingerprintjs.com/api/identify';
const CDN_SRC = 'https://cdn.digitalfingerprintjs.com/v1/originid.global.js';
const CDN_SRI = 'sha384-hiZM5NfgVQJBuaP7+6/cfJT+HzOn7kz2Fcc2jLj18bOKFFfl2uNsBANohwwadgva';
const SCRIPT_SRC = process.env.NEXT_PUBLIC_ORIGINID_SCRIPT_URL || CDN_SRC;

export default function OriginIdInit() {
  const apiKey =
    process.env.NEXT_PUBLIC_ORIGINID_PUBLIC_KEY || process.env.NEXT_PUBLIC_ORIGINID_API_KEY;
  if (!apiKey) return null;

  const start = () => {
    if (!window.OriginID) {
      console.warn('[originid] script loaded but OriginID global is missing');
      return;
    }
    window.OriginID
      .init({ endpoint: ENDPOINT, apiKey })
      .ready()
      .then((result) => {
        console.log('[originid] Origin ID:', result.originId);
        console.log('[originid] Event ID:', result.eventId);
      })
      .catch((err) => console.warn('[originid] identify failed:', err));
  };

  // NOTE: SRI (integrity + crossorigin) is intentionally OFF for now — the
  // vendor CDN doesn't send Access-Control-Allow-Origin, and browsers refuse
  // integrity-checked cross-origin scripts without it (verified 2026-07-18).
  // Reinstate {integrity: CDN_SRI, crossOrigin: 'anonymous'} once the CDN
  // sends ACAO. Hash for that day: see CDN_SRI above.
  void CDN_SRI;
  return (
    <Script
      src={SCRIPT_SRC}
      strategy="afterInteractive"
      onLoad={start}
      onError={() => console.warn(`[originid] SDK script failed to load from ${SCRIPT_SRC}`)}
    />
  );
}
