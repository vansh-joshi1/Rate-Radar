import type { Metadata } from 'next';

/** Only here for the tab title: the page itself is a client component, which can't export metadata. */
export const metadata: Metadata = { title: 'Set up your hotel' };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
