// PostHog cloud region, 'us' or 'eu'. Same value PostHogInit reads.
const phRegion = process.env.NEXT_PUBLIC_POSTHOG_REGION === 'eu' ? 'eu' : 'us';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server code lives in ../backend; let Next compile imports from outside this dir.
  experimental: { externalDir: true },
  // First-party proxy for PostHog (see components/PostHogInit.tsx).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: `https://${phRegion}-assets.i.posthog.com/static/:path*` },
      { source: '/ingest/:path*', destination: `https://${phRegion}.i.posthog.com/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ];
  },
};

export default nextConfig;
