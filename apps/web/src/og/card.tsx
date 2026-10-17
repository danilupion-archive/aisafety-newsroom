import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';

import { splitWordmark } from '@/brand';
import { COLORS, IA_GRADIENT_STOPS } from '@/palette';

import { cardTitle } from './title';

/**
 * Hanken Grotesk, the site's typeface (R-WEB-11), from its static package: the card renderer reads WOFF, not the
 * WOFF2 the pages load. Each file is an asset of the build (`new URL(…, import.meta.url)`), copied with the server's
 * code, so it's there in the standalone output too.
 */
const REGULAR = new URL(
  '../../node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff',
  import.meta.url,
);
const HEAVY = new URL(
  '../../node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-800-normal.woff',
  import.meta.url,
);
const fonts = async () => {
  const [regular, heavy] = await Promise.all([readFile(REGULAR), readFile(HEAVY)]);
  return [
    { name: 'Hanken Grotesk', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: heavy, weight: 800 as const, style: 'normal' as const },
  ];
};

const TEXT = '#F8FAFC';

/**
 * The mark (R-WEB-11), as the header draws it but rendered once to a PNG (src/og/mark.png), since the card renderer
 * draws no SVG filters and the mark's glow is one: 272 px square, the mark's 208 px in the middle and its glow around
 * it, on a transparent ground. An asset of the build, like the fonts.
 */
const MARK_PNG = new URL('./mark.png', import.meta.url);
const markSrc = async () =>
  `data:image/png;base64,${(await readFile(MARK_PNG)).toString('base64')}`;

/** The "IA" as the header writes it, aquamarine to pink, with stops computed in OKLCH (the renderer mixes in sRGB). */
const IA_STYLE = {
  backgroundImage: `linear-gradient(90deg, ${IA_GRADIENT_STOPS.join(', ')})`,
  backgroundClip: 'text',
  color: 'transparent',
} as const;

/**
 * A page's share card (R-WEB-14): what a link to it shows on X, WhatsApp or Telegram. The site's own drawing, never a
 * publisher's photo nor an AI image (R-WEB-3): the mark and the name, the title in large type on navy, and the site's
 * host. 1200 × 630, the size every network takes.
 */
export const shareCard = async ({
  name,
  title,
  footer,
  host,
}: {
  name: string;
  title: string;
  footer: string;
  host: string;
}): Promise<ImageResponse> => {
  const wordmark = splitWordmark(name);
  const heading = cardTitle(title);
  const mark = await markSrc();
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 72px 60px',
        background: COLORS.page,
        color: TEXT,
        fontFamily: 'Hanken Grotesk',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* The PNG's glow margin (40 px a side at this size) overlaps the padding instead of pushing the name away. */}
        {/* oxlint-disable-next-line next/no-img-element -- the card renderer draws plain <img>, not next/image */}
        <img
          src={mark}
          width={170}
          height={170}
          alt=""
          style={{ margin: '-24px -10px -24px -20px' }}
        />
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, letterSpacing: '-0.01em' }}>
          <span>{wordmark.lead}</span>
          {wordmark.ia === '' ? null : <span style={IA_STYLE}>{wordmark.ia}</span>}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: heading.size,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
        }}
      >
        {heading.text}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 30,
          color: COLORS.muted,
          borderTop: `3px solid ${COLORS.accent}`,
          paddingTop: 22,
        }}
      >
        <span style={{ maxWidth: 780 }}>{footer}</span>
        <span style={{ flexShrink: 0 }}>{host}</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: await fonts(),
      // An hour: long enough for the networks that ask again, short enough that a corrected title shows the same day.
      headers: { 'cache-control': 'public, max-age=3600' },
    },
  );
};
