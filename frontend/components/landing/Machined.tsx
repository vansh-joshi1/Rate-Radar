import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowUpRight';

/*
 * The marketing surface's machined parts (DESIGN.md → Marketing surface).
 *
 * Bezel: the double-bezel enclosure. A tinted outer tray with a hairline ring
 * and one soft, navy-tinted ambient shadow; inside it a core panel with its own
 * inner highlight and a radius exactly one padding-width smaller, so the two
 * curves stay concentric. `tone="data"` makes the core Instrument Navy, and
 * only for panels that hold machine readings.
 *
 * PillCta: a fully rounded button whose arrow sits in its own circle, flush
 * with the right padding. On hover the circle nudges up-right; on press the
 * whole pill gives a little.
 */

export const SPRING = 'ease-[cubic-bezier(0.32,0.72,0,1)]';

export function Bezel({
  children,
  className = '',
  core = '',
  tone = 'light',
}: {
  children: React.ReactNode;
  className?: string;
  core?: string;
  tone?: 'light' | 'data';
}) {
  return (
    <div
      className={`rounded-[2rem] bg-[#0b1c30]/[0.035] p-1.5 shadow-[0_32px_64px_-32px_rgba(11,28,48,0.22)] ring-1 ring-[#0b1c30]/[0.05] ${className}`}
    >
      <div
        className={`rounded-[calc(2rem-0.375rem)] ${
          tone === 'data'
            ? 'bg-[#0b1c30] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]'
            : 'bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_1px_2px_rgba(11,28,48,0.04)]'
        } ${core}`}
      >
        {children}
      </div>
    </div>
  );
}

/** A plain line of muted text above a heading. No pill, no caps. */
export function Eyebrow({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'data' }) {
  return (
    <span className={`block text-[15px] font-medium ${tone === 'data' ? 'text-[#adc6ff]' : 'text-[#44474d]'}`}>
      {children}
    </span>
  );
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]';

type PillVariant = 'primary' | 'secondary';
type PillSize = 'md' | 'sm';

function pillClass(variant: PillVariant, size: PillSize) {
  return `group inline-flex items-center justify-between gap-3 whitespace-nowrap rounded-full font-medium transition-[transform,background-color] duration-500 ${SPRING} active:scale-[0.98] active:duration-100 motion-reduce:transition-none ${focusRing} ${
    size === 'sm' ? 'py-1 pl-4 pr-1 text-[13px]' : 'py-1.5 pl-6 pr-1.5 text-[15px]'
  } ${
    variant === 'primary'
      ? 'bg-[#085ac0] text-white hover:bg-[#06489c]'
      : 'bg-white text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08] hover:bg-[#f3f5fc]'
  }`;
}

function PillArrow({ variant, size, icon }: { variant: PillVariant; size: PillSize; icon?: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full transition-transform duration-500 ${SPRING} group-hover:-translate-y-[1px] group-hover:translate-x-1 group-hover:scale-105 group-disabled:translate-x-0 group-disabled:translate-y-0 group-disabled:scale-100 motion-reduce:transition-none ${
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
      } ${variant === 'primary' ? 'bg-white/15' : 'bg-[#0b1c30]/[0.05]'}`}
    >
      {icon ?? <ArrowUpRightIcon weight="light" className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </span>
  );
}

export function PillCta({
  href,
  children,
  variant = 'primary',
  size = 'md',
  icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: PillVariant;
  size?: PillSize;
  /** Swaps the arrow for another glyph, as on PillButton. */
  icon?: React.ReactNode;
}) {
  const inner = (
    <>
      {children}
      <PillArrow variant={variant} size={size} icon={icon} />
    </>
  );
  // A same-page hash goes through a plain anchor: the browser fires `hashchange`
  // for it, which the router's pushState does not (SettingsView listens for it).
  return href.startsWith('#') ? (
    <a href={href} className={pillClass(variant, size)}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={pillClass(variant, size)}>
      {inner}
    </Link>
  );
}

/**
 * PillCta as a form button. Same pill and circle; `icon` swaps the arrow for
 * another glyph (a spinner-free busy state is just a different label).
 */
export function PillButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PillVariant;
  size?: PillSize;
  icon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      className={`${pillClass(variant, size)} disabled:cursor-default disabled:opacity-60 disabled:active:scale-100 ${className}`}
    >
      {children}
      <PillArrow variant={variant} size={size} icon={icon} />
    </button>
  );
}
