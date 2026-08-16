/*
 * Why tonight's number is what it is. Lives on the Rate Calendar next to the
 * forecast table — the dashboard reports the rate, this shows the working.
 *
 * The "too small to matter" lines are deliberately kept and dimmed rather than
 * filtered out: showing what the scoring considered and rejected is the point.
 */

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
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="rounded-lg border border-line bg-card p-md">
      <h3 className="mb-md font-headline-md text-headline-md text-ink">Tonight&apos;s reasoning — {label}</h3>
      <div className="grid items-start gap-xl md:grid-cols-[1.5fr_1fr]">
        <ul className="space-y-2 font-body-md text-body-md">
          {reasoning.map((r, i) => (
            <li
              key={i}
              className={`relative pl-5 before:absolute before:left-0 before:text-accent before:content-['•'] ${
                r.includes('too small') ? 'text-muted' : ''
              }`}
            >
              {r}
            </li>
          ))}
        </ul>
        <div>
          <div className="mb-1 flex justify-between font-label-md text-label-md uppercase">
            <span className="text-muted">Confidence</span>
            <span className="tabular-nums text-ink">{confidence}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-ok" style={{ width: `${confidence}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{confidenceNote}</p>
          <p className="mt-md text-xs text-muted">
            Rate Radar never changes a price anywhere — enter rates in your own system.
          </p>
        </div>
      </div>
    </div>
  );
}
