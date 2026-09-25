import type { Metadata } from 'next';
import './globals.css';
import PostHogInit from '../components/PostHogInit';

export const metadata: Metadata = {
  title: 'Rate Radar — Know what to charge tonight',
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
