/*
 * "When it isn't sure, it says so", drawn as an annotated instrument.
 *
 * Tonight's rate card sits in the middle with one row for each honest state,
 * where it really shows up on the dashboard. The explanations sit outside the
 * card like callouts on a technical drawing, two each side, each joined to its
 * row by a leader line. Everything is visible at once; nothing to click.
 *
 * The page's Reveal wrapper drives the motion through `group/reveal`: as the
 * section arrives, each leader line draws out from the card and its note fades
 * in after it, one row at a time. Under reduced motion it is simply there.
 *
 * Layout: a three-column grid whose rows are shared with the card through
 * `grid-rows-subgrid`, so each callout lines up with its row exactly. Below lg
 * the callouts fold into the rows themselves.
 *
 * Every figure is from the invented demo world (lib/demo.ts).
 */

type Row = {
  name: string;
  note: string;
  label: string;
  tone: string;
  explain: string;
  side: 'left' | 'right';
};

const ROWS: Row[] = [
  {
    name: 'Harbor Run 5K',
    note: 'score 8',
    label: 'Too small to matter',
    tone: 'bg-[#0b1c30]/[0.05] text-[#44474d]',
    explain: 'Weighed, shown, and not applied.',
    side: 'left',
  },
  {
    name: 'Agoda',
    note: 'parity, no price read',
    label: 'Needs manual check',
    tone: 'text-[#b45309] ring-1 ring-inset ring-[#b45309]/40',
    explain: 'A channel blocked the check, so it tells you instead of guessing.',
    side: 'right',
  },
  {
    name: 'Hotel prices',
    note: 'last good read 07:00',
    label: '4h old cache',
    tone: 'bg-[#b45309]/[0.08] text-[#b45309]',
    explain: 'Stale prices are labeled, and confidence drops to match.',
    side: 'left',
  },
  {
    name: 'Convention calendar',
    note: 'page changed',
    label: 'Source broken',
    tone: 'bg-[#ba1a1a]/[0.08] text-[#ba1a1a]',
    explain: 'A failed feed is skipped and named. The run carries on.',
    side: 'right',
  },
];

const chip = 'inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium';
const ROW_START = ['lg:row-start-2', 'lg:row-start-3', 'lg:row-start-4', 'lg:row-start-5'];

/* Line draws first, note follows; each row a beat after the last. */
const lineDelay = (i: number) => ({ transitionDelay: `${350 + i * 260}ms` });
const noteDelay = (i: number) => ({ transitionDelay: `${650 + i * 260}ms` });
const drawn =
  'transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[shown=false]/reveal:scale-x-0 motion-reduce:transition-none';
const faded =
  'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[shown=false]/reveal:opacity-0 motion-reduce:transition-none';

function Callout({ row, i }: { row: Row; i: number }) {
  const left = row.side === 'left';
  return (
    <div
      className={`hidden items-center lg:flex ${ROW_START[i]} ${
        left ? 'lg:col-start-1 flex-row' : 'lg:col-start-3 flex-row-reverse'
      }`}
    >
      <p
        className={`w-[23ch] shrink-0 text-pretty text-[15px] leading-snug text-[#1a1b20] ${faded} ${
          left ? 'text-right group-data-[shown=false]/reveal:translate-x-2' : 'text-left group-data-[shown=false]/reveal:-translate-x-2'
        }`}
        style={noteDelay(i)}
      >
        {row.explain}
      </p>
      {/* leader line, drawn from the card outward */}
      <span aria-hidden className={`relative mx-4 h-px min-w-10 flex-1 ${left ? 'mr-0' : 'ml-0'}`}>
        <span
          className={`absolute inset-0 bg-[#0b1c30]/25 ${drawn} ${left ? 'origin-right' : 'origin-left'}`}
          style={lineDelay(i)}
        />
        <span
          className={`absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#0b1c30]/40 ${left ? '-right-[3px]' : '-left-[3px]'}`}
        />
      </span>
    </div>
  );
}

export default function HonestStates() {
  return (
    <div className="mt-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)_minmax(0,1fr)] lg:grid-rows-[auto_repeat(4,76px)_auto]">
      {ROWS.map((row, i) => (
        <Callout key={row.name} row={row} i={i} />
      ))}

      {/* the card: outer tray and inner core both pass the rows through */}
      <div className="rounded-[2rem] bg-[#0b1c30]/[0.035] p-1.5 shadow-[0_32px_64px_-32px_rgba(11,28,48,0.22)] ring-1 ring-[#0b1c30]/[0.05] lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:grid lg:grid-rows-subgrid">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_1px_2px_rgba(11,28,48,0.04)] md:px-8 lg:row-span-6 lg:grid lg:grid-rows-subgrid">
          <div className="flex items-end justify-between gap-6 pb-6 pt-7 md:pt-8">
            <div>
              <div className="font-geist-mono text-[12px] text-[#44474d]">Tonight, Standard</div>
              <div className="mt-2 text-[44px] font-semibold leading-none tracking-tighter tabular-nums text-[#085ac0]">$89</div>
            </div>
            <div className="w-32 text-right">
              <div className="font-geist-mono text-[12px] text-[#44474d]">Confidence</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-[#1a1b20]">64%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0b1c30]/[0.08]">
                <span className="block h-full w-[64%] rounded-full bg-[#029768]" />
              </div>
            </div>
          </div>

          {ROWS.map((row) => (
            <div key={row.name} className="border-t border-[#0b1c30]/[0.06] py-3.5 lg:flex lg:items-center lg:py-0">
              <div className="flex w-full items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-[#1a1b20]">{row.name}</span>
                  <span className="block truncate font-geist-mono text-[12px] text-[#44474d]">{row.note}</span>
                </span>
                <span className={`${chip} ${row.tone}`}>{row.label}</span>
              </div>
              {/* on narrow screens the callout lives in its row */}
              <p className="mt-2 text-pretty text-[14px] leading-relaxed text-[#44474d] lg:hidden">{row.explain}</p>
            </div>
          ))}

          <p className="border-t border-[#0b1c30]/[0.06] pb-7 pt-5 text-[13px] text-[#44474d] md:pb-8">
            Confidence is 64% because hotel prices are four hours old. The rate still went out, with every gap named.
          </p>
        </div>
      </div>
    </div>
  );
}
