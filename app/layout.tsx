import type { Metadata } from 'next';
import OriginIdInit from '../components/OriginIdInit';
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <OriginIdInit />
      </body>
    </html>
  );
}
