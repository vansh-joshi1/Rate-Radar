import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import PostHogInit from '../components/PostHogInit';
import CookieBanner from '../components/Consent';

// Downloaded at build and served from our own domain: no visitor request reaches Google.
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <PostHogInit />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
