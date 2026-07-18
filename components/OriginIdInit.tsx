'use client';
import Script from 'next/script';

/**
 * DigitalFingerprint (OriginID) visitor identification — site-wide init.
 *
 * Loads the browser SDK from /originid.global.js (drop the file into public/;
 * it ships as dist/originid.global.js in the @visitoriq/client package, which
 * is not on the public npm registry yet — get it from the vendor). Renders
 * nothing until NEXT_PUBLIC_ORIGINID_API_KEY is set, so the site never 404s
 * a script it doesn't have.
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
      src="/originid.global.js"
      strategy="afterInteractive"
      onLoad={start}
      onError={() => console.warn('[originid] /originid.global.js not found — copy the SDK into public/originid.global.js')}
    />
  );
}
