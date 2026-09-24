import { ImageResponse } from 'next/og';

/*
 * The brand mark as a PNG, for email. Gmail and most webmail strip inline
 * SVG, so the emails in lib/email load this instead. Same drawing as
 * app/icon.svg: the RadarIcon mark in white on a Signal Cobalt tile. Rendered
 * at 3x (96px) for a 28px slot so it stays sharp on retina screens.
 */

// Edge for the same reason as app/opengraph-image.tsx (Next 14 og on Node
// breaks on Windows in local dev).
export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#085AC0', borderRadius: 24 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.07 4.93a10 10 0 1 0 2.5 4.07" />
          <path d="M15.5 8.5a5 5 0 1 0 1.9 3.1" />
          <path d="M12 12 20 4" />
          <circle cx="12" cy="12" r="1.4" fill="#FFFFFF" stroke="none" />
        </svg>
      </div>
    ),
    { width: 96, height: 96, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' } }
  );
}
