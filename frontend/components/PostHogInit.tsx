'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * PostHog product analytics. Mounted in the root layout (anonymous) and again
 * in the app layout with the Supabase user ID. Stays OFF until
 * NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set (browser-visible by design).
 *
 * Events go through our own /ingest rewrite (next.config.mjs, which also reads
 * NEXT_PUBLIC_POSTHOG_HOST) so ad blockers don't drop them. The `defaults`
 * date opts into PostHog's recommended config for that release, including
 * pageviews on App Router navigations. Demo visitors are never identified.
 */
const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

export default function PostHogInit({
  distinctId,
  email,
  name,
  role,
}: {
  distinctId?: string;
  email?: string;
  name?: string;
  role?: string;
}) {
  useEffect(() => {
    if (!PROJECT_TOKEN) return;
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
      });
    }
    if (distinctId) posthog.identify(distinctId, { email, name, role });
  }, [distinctId, email, name, role]);
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
