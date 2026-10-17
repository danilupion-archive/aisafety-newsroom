import { defineConfig } from '@pandacss/dev';

import { ACCENT_SOFT, COLORS, HIGHLIGHT_GLOW } from './src/palette';

/**
 * PandorIA's one theme, night (R-WEB-4, R-WEB-11): navy, aquamarine for the workhorse accent and hot pink for
 * highlights only, one typeface (Hanken Grotesk, served by the site itself, so nothing loads from another host). The
 * colours live in src/palette.ts, where a test holds every text colour to WCAG 2.2 AA on the grounds it's used on.
 */
export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  theme: {
    extend: {
      tokens: {
        colors: {
          ...Object.fromEntries(Object.entries(COLORS).map(([name, value]) => [name, { value }])),
          // A tag's fill, and the glow around a highlight.
          accentSoft: { value: ACCENT_SOFT },
          highlightGlow: { value: HIGHLIGHT_GLOW },
        },
        fonts: {
          body: { value: "'Hanken Grotesk Variable', system-ui, sans-serif" },
        },
      },
    },
  },
  globalCss: {
    html: { colorScheme: 'dark', bg: 'page' },
    body: {
      bg: 'page',
      color: 'text',
      fontFamily: 'body',
      lineHeight: '1.6',
      WebkitFontSmoothing: 'antialiased',
    },
    a: { color: 'inherit', textDecoration: 'none' },
    'a:hover': {
      textDecoration: 'underline',
      textDecorationColor: 'accent',
      textDecorationThickness: '2px',
      textUnderlineOffset: '0.2em',
    },
    '*:focus-visible': {
      outline: '2px solid',
      outlineColor: 'accent',
      outlineOffset: '3px',
      borderRadius: '4px',
    },
  },
});
