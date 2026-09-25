/*
 * Why tonight's number is what it is. Lives on Market Intelligence under the
 * events that drive it — the dashboard reports the rate, this shows the working.
 *
 * The "too small to matter" lines are deliberately kept and dimmed rather than
 * filtered out: showing what the scoring considered and rejected is the point.
 */
import { Bezel } from './landing/Machined';
import { fmtWeekdayLong } from '../../backend/lib/date';

export default function ReasoningCard({
  date,
  reasoning,
  confidence,
  confidenceNote,
}: {
  date: string;
  reasoning: string[];
  confidence: number;
  confidenceNote: string;
}) {
  return (
    <Bezel core="grid gap-8 p-6 md:grid-cols-12 md:p-8">
      <div className="md:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[22px] font-semibold tracking-tight">Tonight&apos;s reasoning</h2>
          <span className="font-geist-mono text-[12px] text-[#44474d]">{fmtWeekdayLong(date)}</span>
        </div>
        <ol className="mt-4 divide-y divide-[#0b1c30]/[0.06]">
          {reasoning.map((r, i) => (
            <li
              key={i}
              className={`flex gap-4 py-2.5 text-[14.5px] leading-relaxed ${
                r.includes('too small') ? 'text-[#44474d] opacity-80' : ''
              }`}
            >
              <span className="w-5 shrink-0 pt-0.5 font-geist-mono text-[12px] tabular-nums text-[#44474d]">
                {i + 1}
              </span>
              <span className="min-w-0">{r}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="md:col-span-5">
        <div className="rounded-[1rem] bg-[#0b1c30]/[0.035] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
          <span className="font-geist-mono text-[12px] text-[#44474d]">Confidence</span>
          <p className="mt-1 text-[40px] font-semibold leading-none tracking-tighter tabular-nums">
            {confidence}
            <span className="text-[20px] text-[#44474d]">%</span>
          </p>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#0b1c30]/[0.08]"
            role="meter"
            aria-valuenow={confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Confidence"
          >
            <div className="h-full rounded-full bg-[#029768]" style={{ width: `${confidence}%` }} />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#44474d]">{confidenceNote}</p>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-[#44474d]">
          Rate Radar never changes a price anywhere. Enter rates in your own system.
        </p>
      </div>
    </Bezel>
  );
}
