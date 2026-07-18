import type { ReactNode } from 'react';

export function Chip({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    ok: 'text-ok bg-ok/5',
    warn: 'text-warn bg-warn/5',
    bad: 'text-bad bg-bad/5',
    neutral: 'text-muted bg-ink/5',
  } as const;
  return <span className={`chip ${tones[tone]} ${className}`}>{children}</span>;
}

/** Stamped demand-signal chip: quiet / minor / meaningful / major. */
export function DemandChip({ score }: { score: number }) {
  if (score >= 70) return <span className="chip border-accent bg-accent text-white">major</span>;
  if (score >= 40) return <span className="chip border-transparent bg-accent-muted text-accent">meaningful</span>;
  if (score >= 15) return <span className="chip border-transparent bg-ink/10 text-ink">minor</span>;
  return <span className="chip border-dashed text-muted">quiet</span>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 font-serif text-2xl font-bold">{children}</h2>;
}

/** Truthful marker for panels rendered from sample data (no live feed yet). */
export function SampleBadge() {
  return (
    <span className="chip border-dashed text-muted" title="Rendered from sample data — not wired to a live feed yet">
      sample data
    </span>
  );
}
