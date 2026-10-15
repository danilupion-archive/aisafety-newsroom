import { defineConfig } from '@pandacss/dev';

/**
 * A plain, readable site (R-WEB-4): one column, the system's fonts (nothing loads from another host), contrast that
 * passes WCAG 2.2 AA in light and dark.
 */
export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  conditions: { extend: { dark: '@media (prefers-color-scheme: dark)' } },
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          page: { value: { base: '#ffffff', _dark: '#15171a' } },
          text: { value: { base: '#1d2125', _dark: '#e8eaed' } },
          muted: { value: { base: '#5a636e', _dark: '#a9b1bb' } },
          rule: { value: { base: '#d8dde3', _dark: '#3a4048' } },
          link: { value: { base: '#0b57a4', _dark: '#8ab8f0' } },
        },
      },
    },
  },
  globalCss: {
    body: { bg: 'page', color: 'text', fontFamily: 'system-ui, sans-serif', lineHeight: '1.6' },
    a: { color: 'link', textDecoration: 'underline', textUnderlineOffset: '0.15em' },
    'a:focus-visible': { outline: '2px solid', outlineColor: 'link', outlineOffset: '2px' },
  },
});
