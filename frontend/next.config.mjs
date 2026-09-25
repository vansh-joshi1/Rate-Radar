/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server code lives in ../backend; let Next compile imports from outside this dir.
  experimental: { externalDir: true },
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
