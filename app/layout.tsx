import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rate Radar — Know what to charge tonight',
  description: 'Revenue management for independent hotels. Recommends nightly rates — a human decides.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols — the app chrome's icon set. Declared globally but
            the font file is only fetched on pages that actually use the class,
            so the public landing pays nothing for it. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
