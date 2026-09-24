/*
 * The landing's background, in the product's own terms rather than decoration.
 *
 * HeroRadar: large concentric range rings centred behind the hero's compset
 * panel, with one slow sweep going round, the way the product reads the market
 * twice a day. Navy at a few percent, never cobalt: cobalt marks a conclusion,
 * and the background concludes nothing. The sweep is a CSS animation on
 * `transform` only (`.radar-sweep` in globals.css), so it runs off the main
 * thread, and it stops under reduced motion while the rings stay.
 *
 * DotField and Grain: a faint navy dot grid, the same one the radar panel
 * uses, laid across the whole canvas, and a fixed, pointer-events-none grain
 * so the page reads as a surface rather than flat screen white. Grain lives
 * on a fixed layer only; a filter on a scrolling container would repaint on
 * every frame.
 */

const RINGS = [150, 300, 450, 600, 750];

/**
 * The range rings. The hero gets the full set with the sweep; the closing
 * section gets a smaller, still echo so the page ends the way it began.
 */
export function HeroRadar({ variant = 'hero' }: { variant?: 'hero' | 'echo' }) {
  const place =
    variant === 'hero'
      ? 'left-1/2 top-[68%] h-[1500px] w-[1500px] lg:left-[73%] lg:top-[54%]'
      : 'left-[85%] top-1/2 h-[1100px] w-[1100px] opacity-80 md:left-[80%]';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className={`absolute -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,#000_30%,transparent)] ${place}`}>
        <svg viewBox="0 0 1500 1500" className="absolute inset-0 h-full w-full" fill="none">
          {RINGS.map((r) => (
            <circle key={r} cx="750" cy="750" r={r} stroke="#0b1c30" strokeOpacity="0.1" />
          ))}
          <path d="M750 0v1500M0 750h1500" stroke="#0b1c30" strokeOpacity="0.045" />
        </svg>
        {variant === 'hero' && (
        <div
          className="radar-sweep absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(11,28,48,0) 0deg, rgba(11,28,48,0) 280deg, rgba(11,28,48,0.06) 335deg, rgba(11,28,48,0.14) 359deg, rgba(11,28,48,0) 360deg)',
          }}
        />
        )}
      </div>
    </div>
  );
}

/** Fixed grain over the whole page. Sits under the island nav (z-40). */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 opacity-[0.035] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/** The radar panel's dot grid, very faint, as the page's canvas. */
export const DOT_FIELD = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(11,28,48,0.075) 1px, transparent 0)',
  backgroundSize: '28px 28px',
} as const;
