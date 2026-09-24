import type { ReactNode } from 'react';

/*
 * Shared parts for the Settings panels, on the Machined Instrument language
 * (DESIGN.md). Kept in one place so the four panels (property & rates, team,
 * notifications, integrations) read as one surface: the same mono labels,
 * the same pill fields, the same status chips.
 */

export const MONO_LABEL = 'font-geist-mono text-[12px] text-[#44474d]';

export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/* A pill field (DESIGN.md → Inputs, migrated surfaces): white, a navy ring at
   12%, cobalt ring on focus, warn ring when the value is refused. */
export const FIELD =
  'h-10 w-full rounded-full bg-white px-4 text-[14.5px] text-[#1a1b20] ring-1 ring-[#0b1c30]/[0.12] shadow-[inset_0_1px_2px_rgba(11,28,48,0.04)] outline-none transition-shadow duration-200 placeholder:text-[#44474d]/70 hover:ring-[#0b1c30]/20 focus:ring-2 focus:ring-[#085ac0]/60 disabled:cursor-not-allowed disabled:bg-[#0b1c30]/[0.03] disabled:text-[#44474d]';
/* For number fields only: the spinners crowd a narrow pill, and arrow keys still step. */
export const NUMBER =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
export const FIELD_BAD = 'ring-2 ring-[#b45309]/60 focus:ring-[#b45309]/70';

export const DIVIDER = 'h-px bg-[#0b1c30]/[0.06]';

const CHIP = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium';
const TONES = {
  ok: 'bg-[#029768]/[0.08] text-[#027a55]',
  warn: 'bg-[#b45309]/[0.08] text-[#b45309]',
  bad: 'bg-[#ba1a1a]/[0.08] text-[#ba1a1a]',
  accent: 'bg-[#e5eeff] text-[#085ac0]',
  quiet: 'bg-[#0b1c30]/[0.05] text-[#44474d]',
} as const;
export type Tone = keyof typeof TONES;

export function StatusChip({ tone = 'quiet', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`${CHIP} ${TONES[tone]}`} title={title}>
      {children}
    </span>
  );
}

/** A panel heading: the title, and an optional chip or action aligned to it. */
export function PanelHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

/** The one line of feedback after a save: coloured by outcome, announced to screen readers. */
export function StatusLine({ status }: { status: { tone: 'ok' | 'bad' | 'muted'; text: string } | null }) {
  if (!status) return null;
  return (
    <p
      role="status"
      className={`text-[13.5px] leading-relaxed ${
        status.tone === 'ok' ? 'text-[#027a55]' : status.tone === 'bad' ? 'text-[#b45309]' : 'text-[#44474d]'
      }`}
    >
      {status.text}
    </p>
  );
}

/** Small print at the foot of a panel. */
export function Footnote({ children }: { children: ReactNode }) {
  return <p className="max-w-[72ch] text-pretty text-[13px] leading-relaxed text-[#44474d]">{children}</p>;
}

/** Inline code, tinted rather than boxed. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[0.375rem] bg-[#0b1c30]/[0.05] px-1.5 py-0.5 font-geist-mono text-[0.92em] text-[#1a1b20]">
      {children}
    </code>
  );
}
