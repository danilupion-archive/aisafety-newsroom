/**
 * PandorIA's colours (R-WEB-11): one source for the theme (panda.config.ts), the share cards and their contrast test.
 * Two accents with set roles: aquamarine is the workhorse (links, tags, dates, buttons, switches, focus); hot pink is
 * for highlights only (the mark's glow, the breves' timeline dots, the video play button, a followed link's bar) and
 * never carries small text. Text on either fill is the page's navy.
 */
export const COLORS = {
  // The page and what sits on it: cards, and the darker box of a post's sources.
  page: '#0F172A',
  card: '#1E293B',
  deep: '#0B1220',
  // Borders, the timeline's rail, quiet fills.
  rule: '#334155',
  // Headings and links; running text; dates, counts and asides.
  text: '#F1F5F9',
  body: '#CBD5E1',
  muted: '#94A3B8',
  // The workhorse accent: aquamarine.
  accent: '#7FFFD4',
  // The highlight: hot pink.
  highlight: '#FF4FD8',
} as const;

/** A tag's fill: the accent at 14 % over a card. */
export const ACCENT_SOFT = 'rgba(127, 255, 212, 0.14)';

/** The pink glow around a highlight (a breve's dot, the play button). */
export const HIGHLIGHT_GLOW = 'rgba(255, 79, 216, 0.6)';

/**
 * The wordmark's "IA", aquamarine to pink (the pages interpolate it in OKLCH: .wordmark-ia in src/app/globals.css). In OKLCH it
 * passes through cyan, sky blue and violet instead of the grey an sRGB mix would give; the share cards, drawn without
 * OKLCH, use these stops, computed in OKLCH.
 */
export const IA_GRADIENT_STOPS = ['#7FFFD4', '#00EDFF', '#5EC5FF', '#C28DFF', '#FF4FD8'] as const;

const channel = (hex: string, at: number): number => {
  const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** A colour's relative luminance (WCAG 2.2), from `#RRGGBB`. */
export const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

/** The contrast ratio between two `#RRGGBB` colours (WCAG 2.2), from 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};
