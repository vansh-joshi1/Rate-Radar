import type { Config } from 'tailwindcss';

// Colors resolve through RGB-channel CSS variables (defined in globals.css for
// light and dark) so Tailwind opacity modifiers like bg-ink/5 work.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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
        ok: c('ok-rgb'),
        warn: c('warn-rgb'),
        bad: c('bad-rgb'),
      },
      fontFamily: {
        // Fraunces is reserved for the big rate numbers — everything else is Inter.
        serif: ['Fraunces', 'Georgia', 'serif'],
        // Sora is the marketing-landing display face; the app behind login never uses it.
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
