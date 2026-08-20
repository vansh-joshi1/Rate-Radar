import type { Config } from 'tailwindcss';

// Colors resolve through RGB-channel CSS variables (defined in globals.css for
// light and dark) so Tailwind opacity modifiers like bg-ink/5 work.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // Matches the design system: dark is opt-in via a class, never inferred from
  // the viewer's OS preference.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: c('paper-rgb'),
        card: c('card-rgb'),
        ink: c('ink-rgb'),
        muted: c('muted-rgb'),
        line: c('line-rgb'),
        accent: {
          DEFAULT: c('accent-rgb'),
          deep: c('accent-deep-rgb'),
          muted: c('accent-muted-rgb'),
        },
        // deep navy data surfaces (radar panels, dark stat fills)
        deep: c('deep-rgb'),
        // heatmap ramp, low → high
        heat: {
          1: c('heat-1-rgb'),
          2: c('heat-2-rgb'),
          3: c('heat-3-rgb'),
          4: c('heat-4-rgb'),
        },
        // price-level dots on the watchlist grid
        level: {
          low: c('level-low-rgb'),
          mid: c('level-mid-rgb'),
          high: c('level-high-rgb'),
        },
        ok: c('ok-rgb'),
        warn: c('warn-rgb'),
        bad: c('bad-rgb'),
      },
      // The four shadows the system owns (DESIGN.md → Elevation & Depth).
      // Surfaces are flat at rest; a shadow means the element is responding to
      // interaction or genuinely floating above the page. Every value is tinted
      // with Instrument Navy rather than black — that cool key is what keeps the
      // depth from reading as a generic admin panel.
      boxShadow: {
        'hover-lift': '0 4px 12px rgba(11, 28, 48, 0.05)',
        'overlay-sm': '0 8px 24px rgba(11, 28, 48, 0.08)',
        'overlay-lg': '0 24px 60px -20px rgba(11, 28, 48, 0.45)',
      },
      fontFamily: {
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
        // ---- design-system aliases (match the Figma token names 1:1) ----
        'headline-xl': ['Sora', 'Inter', 'sans-serif'],
        'headline-lg': ['Sora', 'Inter', 'sans-serif'],
        'headline-lg-mobile': ['Sora', 'Inter', 'sans-serif'],
        'headline-md': ['Sora', 'Inter', 'sans-serif'],
        'body-lg': ['Inter', 'system-ui', 'sans-serif'],
        'body-md': ['Inter', 'system-ui', 'sans-serif'],
        'label-md': ['Inter', 'system-ui', 'sans-serif'],
        'data-mono': ['Inter', 'system-ui', 'sans-serif'],
      },
      // Named steps from the design system. Additive — the numeric scale is
      // untouched, so nothing existing shifts.
      spacing: {
        base: '4px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        gutter: '20px',
        lg: '24px',
        'margin-safe': '24px',
        xl: '32px',
        'sidebar-width': '280px',
      },
      fontSize: {
        // Marketing display steps — used in responsive pairs: the hero is
        // display-lg → display-xl, section headings are display-sm → display-md.
        'display-xl': ['56px', { lineHeight: '60px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['42px', { lineHeight: '46px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['38px', { lineHeight: '46px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'title-sm': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        // 11px carries chips and table headers; 10px is the smallest uppercase
        // marker. Both were already load-bearing before they had names.
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        micro: ['10px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' }],
        'data-mono': ['14px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};

/*
 * Deliberately NOT importing the design system's borderRadius scale. It
 * redefines `full` as 0.75rem, and `rounded-full` is load-bearing for every
 * avatar, pill and chip in the app — adopting it would turn circles into
 * squircles app-wide. Radii are set explicitly at the call site instead.
 */

export default config;
