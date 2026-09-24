import type { RateCheck } from '../lib/scoring/types';
import { trackedParity } from '../lib/parity/channels';
import { Bezel } from './landing/Machined';

/*
 * Your own listed rate on the channels this property reports parity against:
 * the direct site, Booking.com and Expedia.com (see lib/parity/channels.ts).
 * Lives on the Competitors page. The dashboard shows the recommendation, this
 * shows where your price is visible to guests.
 *
 * Built around one question: is either OTA selling your rooms for less than you
 * are? Channels are sorted cheapest-first for that reason, and anything under
 * the direct rate is called out rather than buried.
 *
 * Note what this can no longer answer. Google lists ~26 channels and the one
 * undercutting a direct rate is usually a reseller nobody thought to check; by
 * reporting three, this panel can say nothing about the other twenty-three.
 * The copy below is careful to claim only what the three channels support:
 * "neither is below your direct rate", never "nothing is".
 *
 * An undercut is State Warn, not State Bad: it is something to act on, not
 * something broken (DESIGN.md → The Warn-Not-Fail Rule).
 */

const VISIBLE = 8;
const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';

export default function ParityGrid({ parity }: { parity: RateCheck[] }) {
  const tracked = trackedParity(parity);
  if (tracked.length === 0) return null;

  const official = tracked.find((p) => p.official);
  const others = tracked
    .filter((p) => !p.official && p.status === 'ok' && p.price != null)
    .sort((a, b) => a.price! - b.price!);

  const direct = official?.status === 'ok' ? official.price ?? null : null;
  const undercutters = direct != null ? others.filter((p) => p.price! < direct) : [];
  const worst = undercutters[0];
  const gap = direct != null && worst ? direct - worst.price! : 0;

  const shown = others.slice(0, VISIBLE);
  const hidden = others.length - shown.length;

  const summary =
    direct == null
      ? // No direct rate means no comparison. Saying "nothing is undercutting you"
        // here would be asserting something this data cannot support.
        'Your direct rate was not returned this run, so there is nothing to compare the channels against.'
      : others.length === 0
        ? // Neither OTA priced this run. That is not the same as being in parity.
          'Neither Booking.com nor Expedia returned a price this run, so there is nothing to compare your direct rate against.'
        : undercutters.length > 0
          ? `${undercutters.length} ${undercutters.length === 1 ? 'channel is' : 'channels are'} selling below your direct rate. The cheapest is ${worst.source} at $${worst.price}.`
          : // Scoped deliberately. Only two OTAs are checked, so "nothing is
            // selling below your direct rate" would be a claim about the
            // twenty-three channels this panel never looked at.
            `${others.length === 1 ? `${others[0].source} is not` : 'Neither Booking.com nor Expedia is'} selling below your direct rate.`;

  return (
    <Bezel className="h-full" core="flex h-full flex-col p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">Your rate by channel</h2>
        {gap > 0 && (
          <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium text-[#b45309] ring-1 ring-[#b45309]/40">
            ${gap} below direct
          </span>
        )}
      </div>

      {official && (
        <div className="mt-5">
          <span className={MONO_LABEL}>Direct, {official.source}</span>
          {official.status === 'ok' ? (
            <p className="mt-1 text-[40px] font-semibold leading-none tracking-tighter tabular-nums">${official.price}</p>
          ) : (
            <p className="mt-2">
              <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium text-[#b45309] ring-1 ring-[#b45309]/40">
                Needs manual check
              </span>
            </p>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-5 divide-y divide-[#0b1c30]/[0.06] border-t border-[#0b1c30]/[0.06]">
          {shown.map((p, i) => {
            const below = direct != null && p.price! < direct;
            return (
              // Google occasionally lists the same channel twice, so the name alone is not a key.
              <li key={`${p.source}-${i}`} className="flex items-baseline justify-between gap-4 py-3">
                <span className="min-w-0 truncate text-[14.5px]" title={p.source}>
                  {p.source}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {direct != null && (
                    <span className={`font-geist-mono text-[12px] tabular-nums ${below ? 'text-[#b45309]' : 'text-[#44474d]'}`}>
                      {p.price === direct ? 'Matched' : `${below ? '-' : '+'}$${Math.abs(p.price! - direct)}`}
                    </span>
                  )}
                  <span className={`font-geist-mono text-[15px] font-medium tabular-nums ${below ? 'text-[#b45309]' : ''}`}>
                    ${p.price}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <p className={`${MONO_LABEL} mt-2 tabular-nums`}>
          {hidden} more {hidden === 1 ? 'channel' : 'channels'} at ${shown[shown.length - 1].price} or above
        </p>
      )}

      <p className="mt-5 text-pretty text-[14.5px] leading-relaxed">{summary}</p>
      <p className="mt-auto pt-4 text-[13px] leading-relaxed text-[#44474d]">
        Checked for tomorrow night: the cheapest public rate per channel, as Google sees it. Booking.com and Expedia.com
        only. Other resellers are collected but not reported here.
      </p>
    </Bezel>
  );
}
