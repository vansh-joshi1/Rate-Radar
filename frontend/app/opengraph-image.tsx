import { ImageResponse } from 'next/og';

/*
 * The link-preview card for the demo link when it's pasted into Slack, email
 * or a text. Same palette as the landing; the $89 is the demo hotel's
 * recommendation.
 * Uses the renderer's built-in sans: fetching Sora at render time would make
 * the card depend on a network call.
 */

// Edge, not Node: on Node, Next 14's bundled @vercel/og resolves its default
// font to an invalid file URL on Windows, and the route 500s in local dev.
export const runtime = 'edge';

export const alt ='Rate Radar: know what to charge tonight. Recommends nightly hotel rates, and a human decides.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#F8F9FF',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700, color: '#0B1C30' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#085AC0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.07 4.93a10 10 0 1 0 2.5 4.07" />
              <path d="M15.5 8.5a5 5 0 1 0 1.9 3.1" />
              <path d="M12 12 20 4" />
              <circle cx="12" cy="12" r="1.4" fill="#085AC0" stroke="none" />
            </svg>
            Rate Radar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: '#0B1C30', letterSpacing: -2, lineHeight: 1.05 }}>
              Know what to charge tonight.
            </div>
            <div style={{ marginTop: 24, fontSize: 30, color: '#44474D' }}>It recommends. You decide.</div>
          </div>
        </div>

        <div
          style={{
            width: 330,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#0B1C30',
            borderRadius: 24,
            padding: 40,
          }}
        >
          <div style={{ fontSize: 22, color: '#ADC6FF' }}>Tonight, Standard</div>
          <div style={{ fontSize: 110, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>$89</div>
          <div style={{ fontSize: 24, color: '#67DCA8' }}>+13% vs $79 baseline</div>
        </div>
      </div>
    ),
    size,
  );
}
