// PostHog ingestion host, e.g. https://us.i.posthog.com.
const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const phAssets = phHost.replace('.i.posthog.com', '-assets.i.posthog.com');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server code lives in ../backend; let Next compile imports from outside this dir.
  // serverComponentsHmrCache replays earlier fetch responses (Supabase included,
  // despite noStore) during a dev hot reload. Local dev can point at the real
  // database, so a replayed "no account yet" once overwrote a paid account with
  // a fresh trial. Dev reads must always be live.
  experimental: { externalDir: true, serverComponentsHmrCache: false },
  // First-party proxy for PostHog (see components/PostHogInit.tsx).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: `${phAssets}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${phAssets}/array/:path*` },
      { source: '/ingest/:path*', destination: `${phHost}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          // Nobody frames the dashboard: blocks clickjacking a signed-in user's controls.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
