'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * PostHog product analytics. Mounted once in the root layout; renders nothing
 * and stays OFF until NEXT_PUBLIC_POSTHOG_KEY is set (a phc_ project key,
 * browser-visible by design).
 *
 * Events go through our own /ingest rewrite (next.config.mjs) so ad blockers
 * don't drop them. The `defaults` date opts into PostHog's recommended config
 * for that release, which includes pageviews on App Router navigations.
 *
 * `email` identifies a personal account. The shared site password and demo
 * visitors stay anonymous: pass nothing.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const REGION = process.env.NEXT_PUBLIC_POSTHOG_REGION === 'eu' ? 'eu' : 'us';

export default function PostHogInit({ email }: { email?: string }) {
  useEffect(() => {
    if (!KEY) return;
    if (!posthog.__loaded) {
      posthog.init(KEY, {
        api_host: '/ingest',
        ui_host: `https://${REGION}.posthog.com`,
        defaults: '2026-08-30',
        person_profiles: 'identified_only',
      });
    }
    if (email) posthog.identify(email, { email });
  }, [email]);
  return null;
}

/** Call before sign-out so the next person on this browser isn't merged into the last. */
export function resetAnalytics() {
  if (KEY && posthog.__loaded) posthog.reset();
}
