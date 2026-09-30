import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import PostHogInit from '../components/PostHogInit';
import CookieBanner from '../components/Consent';

// Served from our own domain, and read from @fontsource at build: neither visitors nor the build
// reach Google (next/font/google failed builds whenever Google answered with an unexpected URL).
// next/font needs literal paths, so the six files are spelled out.
const plexSans = localFont({
  src: [
    { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', weight: '500' },
    { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', weight: '600' },
    { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-sans',
});
const plexMono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
  ],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: { default: 'Rate Radar — Know what to charge tonight', template: '%s · Rate Radar' },
  description: 'Revenue management for independent hotels. Recommends nightly rates — a human decides.',
  robots: { index: false, follow: false },
  // The image comes from app/opengraph-image.tsx. Previews matter even while
  // the site is noindex: the demo link gets shared by hand.
  openGraph: {
    title: 'Rate Radar: know what to charge tonight',
    description: 'Nightly rate recommendations for independent hotels, with the arithmetic attached. It recommends; you decide.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <PostHogInit />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
