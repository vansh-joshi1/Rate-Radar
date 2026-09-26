'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/ssr/HourglassMedium';
import { PillCta } from './landing/Machined';

/**
 * Stands in for every data page of a newly approved hotel until its first
 * collection lands. Settings stays open: inviting the team and checking the
 * baseline rates are exactly what a new owner can do while waiting.
 */
export default function AwaitingFirstRun({ hotel, children }: { hotel: string; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/settings')) return <>{children}</>;
  return (
    <div className="flex flex-col gap-5 rounded-[1.25rem] bg-[#0b1c30]/[0.04] px-6 py-6 font-geist text-[#1a1b20] antialiased ring-1 ring-[#0b1c30]/[0.06]">
      <div className="flex items-start gap-3">
        <HourglassMediumIcon weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-[#44474d]" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-[18px] font-semibold">{hotel} is set up</h1>
          <p className="max-w-[70ch] text-[14.5px] leading-relaxed text-[#44474d]">
            Rate Radar collects prices and demand twice a day. Your first recommendations, competitor rates and local
            events appear after the next run, usually within half a day. Until then, you can invite your team and check
            the starting baseline rates, which came from the prices Google showed for your rooms.
          </p>
        </div>
      </div>
      <div>
        <PillCta href="/settings" size="sm">
          Open settings
        </PillCta>
      </div>
    </div>
  );
}
