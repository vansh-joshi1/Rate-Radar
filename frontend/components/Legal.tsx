import Link from 'next/link';
import { RadarIcon } from './RadarMark';
import { focusRing, textLink } from './landing/Machined';

/*
 * The shell the four legal pages share (/privacy, /terms, /cookies, /refunds),
 * on the marketing surface's colours (DESIGN.md → Marketing surface).
 * Fixed-light hex, like the landing. Plain reading text, nothing machined:
 * these pages are read, not glanced at.
 */

export const LEGAL_PAGES = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/refunds', label: 'Refunds' },
] as const;


/** Where privacy and billing questions go: the Rate Radar owner (OWNER_EMAIL). */
export function ContactEmail() {
  const email = process.env.OWNER_EMAIL;
  return email ? (
    <a href={`mailto:${email}`} className={textLink}>
      {email}
    </a>
  ) : (
    <>the Rate Radar owner</>
  );
}

/** The legal pages as a row of links, for footers. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
      {LEGAL_PAGES.map((p) => (
        <Link key={p.href} href={p.href} className={textLink}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f8f9ff] px-4 font-geist text-[#1a1b20] antialiased md:px-6">
      <header className="mx-auto flex max-w-[70ch] flex-wrap items-center justify-between gap-4 pt-6">
        <Link
          href="/"
          className={`flex items-center gap-2 rounded-full bg-white/70 py-2 pl-4 pr-5 ring-1 ring-[#0b1c30]/[0.06] ${focusRing}`}
        >
          <RadarIcon className="h-5 w-5 text-[#085ac0]" />
          <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
        </Link>
        <LegalLinks className="text-[14px]" />
      </header>

      <main
        id="main"
        className="mx-auto max-w-[70ch] py-14 text-[16px] leading-relaxed text-[#44474d] md:py-20 [&_h2]:mt-12 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[#0b1c30] [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[#0b1c30] [&_li]:mt-1.5 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-[#1a1b20] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
      >
        <h1 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[44px]">
          {title}
        </h1>
        <p className="text-[14px]">Last updated {updated}</p>
        {children}
      </main>

      <footer className="mx-auto max-w-[70ch] border-t border-[#0b1c30]/[0.08] py-8 text-[13px] text-[#44474d]">
        <p>&copy; 2026 Rate Radar. Recommendation only. Rate Radar never changes a price anywhere.</p>
      </footer>
    </div>
  );
}
