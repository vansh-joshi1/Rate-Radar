/*
 * The Rate Radar brand mark, shared by the marketing landing and the auth
 * screens so the two can't drift apart. Inline SVG on purpose — the logged-in
 * app uses the shared root layout, and a webfont for one glyph isn't worth it.
 */

type Props = { className?: string };

export function RadarIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M19.07 4.93a10 10 0 1 0 2.5 4.07" />
      <path d="M15.5 8.5a5 5 0 1 0 1.9 3.1" />
      <path d="M12 12 20 4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
