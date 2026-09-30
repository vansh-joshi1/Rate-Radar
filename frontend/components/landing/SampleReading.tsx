/*
 * The demo world's Saturday reading (lib/demo.ts): the rate, its range, and
 * the reasons behind it with the rejected one dimmed. Shared by the landing's
 * reasoning preview (app/page.tsx) and the sign-in screen's readout
 * (components/AuthPanes.tsx), which set their own size and wording.
 */

export type Reason = { text: string; delta: string; rejected?: boolean };

export function SampleReading({ reasons, rateSize }: { reasons: Reason[]; rateSize: string }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-geist-mono text-[12px] text-[#44474d]">Saturday, Standard</div>
          <div className={`mt-2 ${rateSize} font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0]`}>
            $92
          </div>
        </div>
        <div className="text-right font-geist-mono text-[13px] tabular-nums text-[#44474d]">
          <div>$88 to $96</div>
          <div className="text-[#047857]">+10% vs baseline</div>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-[#0b1c30]/[0.06]">
        {reasons.map((r) => (
          <li key={r.text} className="flex items-baseline justify-between gap-4 py-3 text-[14px] leading-snug">
            <span className={`flex min-w-0 gap-3 ${r.rejected ? 'text-[#44474d]' : 'text-[#1a1b20]'}`}>
              <span aria-hidden className={r.rejected ? 'text-[#0b1c30]/25' : 'text-[#085ac0]'}>
                •
              </span>
              {r.text}
            </span>
            {r.rejected ? (
              <span className="shrink-0 rounded-full bg-[#0b1c30]/[0.05] px-2.5 py-0.5 text-[12px] font-medium text-[#44474d]">
                {r.delta}
              </span>
            ) : (
              <span className="shrink-0 font-geist-mono text-[13px] tabular-nums">{r.delta}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
