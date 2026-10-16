import { defineConfig } from '@pandacss/dev';

/**
 * PandorIA's one theme, night (R-WEB-4): navy and orange, one typeface (Hanken Grotesk, served by the site itself, so
 * nothing loads from another host). Every text colour on every background it's used on passes WCAG 2.2 AA; orange is
 * never text on a light background.
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
          // The page and what sits on it: cards, and the darker box of a post's sources.
          page: { value: '#0F172A' },
          card: { value: '#1E293B' },
          deep: { value: '#0B1220' },
          // Borders, the timeline's rail, quiet fills.
          rule: { value: '#334155' },
          // Headings and links; running text; dates, counts and asides.
          text: { value: '#F1F5F9' },
          body: { value: '#CBD5E1' },
          muted: { value: '#94A3B8' },
          accent: { value: '#FF9416' },
          accentSoft: { value: 'rgba(255, 148, 22, 0.15)' },
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
