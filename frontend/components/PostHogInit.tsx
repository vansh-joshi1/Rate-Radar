'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useConsent } from './Consent';

/**
 * PostHog product analytics. Mounted in the root layout (anonymous) and again
 * in the app layout with the Supabase user ID. Stays OFF until
 * NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set (browser-visible by design), and
 * until the visitor accepts analytics (components/Consent.tsx). Declining later
 * opts out and deletes PostHog's cookies.
 *
 * Events go through our own /ingest rewrite (next.config.mjs, which also reads
 * NEXT_PUBLIC_POSTHOG_HOST). The `defaults` date opts into PostHog's
 * recommended config for that release, including pageviews on App Router
 * navigations. People are identified by user ID and role only: no email, no
 * name. Demo visitors are never identified.
 */
const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

export default function PostHogInit({ distinctId, role }: { distinctId?: string; role?: string }) {
  const consent = useConsent();
  useEffect(() => {
    if (!PROJECT_TOKEN) return;
    if (consent === 'denied' && posthog.__loaded) posthog.opt_out_capturing();
    if (consent !== 'granted') return;
    if (!posthog.__loaded) {
      posthog.init(PROJECT_TOKEN, {
        api_host: '/ingest',
        defaults: '2026-08-30',
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
        person_profiles: 'identified_only',
        // An opt-out removes PostHog's cookies instead of just going quiet.
        opt_out_persistence_by_default: true,
      });
    }
    // Accepting again after a decline: PostHog remembers the opt-out on its own.
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    if (distinctId) posthog.identify(distinctId, { role });
  }, [consent, distinctId, role]);
  return null;
}

/** Call before sign-out so the next person on this browser isn't merged into the last. */
export function resetAnalytics() {
  if (posthog.__loaded) posthog.reset();
}

/** Capture a product event. A no-op while PostHog is off. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded) posthog.capture(event, properties);
}
