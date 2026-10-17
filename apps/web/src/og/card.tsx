import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';

import { splitWordmark } from '@/brand';

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

const NAVY = '#0F172A';
const ORANGE = '#FF9416';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';

/** The box with its lid ajar and light escaping (R-WEB-11), as the header draws it. */
const MARK = (
  <svg width={104} height={104} viewBox="0 0 120 120">
    <g fill={ORANGE} opacity={0.5}>
      <polygon points="96,52 120,42 120,50" />
      <polygon points="96,48 115,20 120,27" />
      <polygon points="94,46 103,3 111,6" />
    </g>
    <polygon points="24,60 96,60 96,43 24,58" fill={ORANGE} />
    <rect x="24" y="60" width="72" height="44" rx="5" fill="#E2E8F0" />
    <rect x="24" y="60" width="72" height="7" fill="#CBD5E1" />
    <polygon points="18,52 100,34 102,43 20,61" fill={TEXT} />
  </svg>
);

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
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 72px 60px',
        background: NAVY,
        color: TEXT,
        fontFamily: 'Hanken Grotesk',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {MARK}
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, letterSpacing: '-0.01em' }}>
          <span>{wordmark.lead}</span>
          {wordmark.ia === '' ? null : <span style={{ color: ORANGE }}>{wordmark.ia}</span>}
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
          color: MUTED,
          borderTop: `3px solid ${ORANGE}`,
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
