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

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-2xl font-bold tracking-tight">{children}</h2>;
}

/** Truthful marker for panels rendered from sample data (no live feed yet). */
export function SampleBadge() {
  return (
    <span className="chip border-dashed text-muted" title="Rendered from sample data — not wired to a live feed yet">
      sample data
    </span>
  );
}
