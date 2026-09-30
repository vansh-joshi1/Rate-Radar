import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import PostHogInit from '../components/PostHogInit';
import CookieBanner from '../components/Consent';

// Downloaded at build and served from our own domain: no visitor request reaches Google.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-sora' });

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
    // Font variables once for the whole app; surfaces opt in with `font-geist`.
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${sora.variable}`}>
      <body>
        <PostHogInit />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
