'use client';
import Script from 'next/script';

/**
 * DigitalFingerprint (OriginID) visitor identification — CDN script-tag
 * integration (no npm dependency). Mounted on the public landing page ONLY
 * (owner request) — signed-in app pages are not fingerprinted.
 *
 * Script source: NEXT_PUBLIC_ORIGINID_SCRIPT_URL (a vendor CDN URL), or the
 * default /originid.global.js served from public/ (drop the vendor's
 * dist/originid.global.js there). Renders nothing until
 * NEXT_PUBLIC_ORIGINID_API_KEY is set, so the site never 404s a script it
 * doesn't have.
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
        signingSecret?: string;
        onIdentify?: (result: OriginIdResult) => void;
      }): { ready(): Promise<OriginIdResult> };
    };
  }
}

const ENDPOINT = 'https://api.digitalfingerprintjs.com/api/identify';
const SCRIPT_SRC = process.env.NEXT_PUBLIC_ORIGINID_SCRIPT_URL || '/originid.global.js';

export default function OriginIdInit() {
  const apiKey = process.env.NEXT_PUBLIC_ORIGINID_API_KEY;
  if (!apiKey) return null;

  const start = () => {
    if (!window.OriginID) {
      console.warn('[originid] script loaded but OriginID global is missing');
      return;
    }
    window.OriginID
      .init({
        endpoint: ENDPOINT,
        apiKey,
        // Required when the project enforces request signing. Browser-visible
        // by nature of NEXT_PUBLIC_* — use a key/secret pair scoped for
        // client use, or proxy identify server-side if the vendor supports it.
        signingSecret: process.env.NEXT_PUBLIC_ORIGINID_SIGNING_SECRET || undefined,
      })
      .ready()
      .then((result) => {
        console.log('[originid] Origin ID:', result.originId);
        console.log('[originid] Event ID:', result.eventId);
      })
      .catch((err) => console.warn('[originid] identify failed:', err));
  };

  return (
    <Script
      src={SCRIPT_SRC}
      strategy="afterInteractive"
      onLoad={start}
      onError={() =>
        console.warn(
          `[originid] SDK script failed to load from ${SCRIPT_SRC} — set NEXT_PUBLIC_ORIGINID_SCRIPT_URL to the vendor CDN URL, or copy the SDK into public/originid.global.js`
        )
      }
    />
  );
}
