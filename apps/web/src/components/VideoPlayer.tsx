'use client';

import { css } from '@styled-system/css';
import Image from 'next/image';
import { useState } from 'react';

import type { Lang } from '@/i18n';

import { STRINGS } from '@/strings';
import { youtubeEmbed } from '@/video';

const frame = css({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  borderRadius: 'lg',
  overflow: 'hidden',
  bg: 'deep',
});
const fill = css({ position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0' });
const still = css({ objectFit: 'cover' });
const button = css({
  position: 'absolute',
  inset: '0',
  width: '100%',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  bg: 'transparent',
  '&:hover > span, &:focus-visible > span': { transform: 'scale(1.08)' },
});
const play = css({
  width: { base: '56px', md: '68px' },
  height: { base: '56px', md: '68px' },
  borderRadius: 'full',
  // A highlight (R-WEB-11): the pink, glowing, with the navy triangle on it.
  bg: 'highlight',
  color: 'page',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45), 0 0 22px token(colors.highlightGlow)',
  transition: 'transform 0.15s ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});
const caption = css({ color: 'muted', fontSize: '0.875rem', marginTop: '2' });

/**
 * A video source as a player that loads only when the reader asks (R-WEB-12): until then the site's own still (when
 * the switches show it) and a play button, so nothing reaches YouTube for a reader who doesn't play it (R-WEB-7). Pressed, YouTube's
 * privacy-enhanced player takes the still's place and plays there. The caption says where it comes from.
 */
export const VideoPlayer = ({
  lang,
  videoId,
  stillSrc,
  title,
  credit,
  caption: withCaption = true,
  className,
}: {
  lang: Lang;
  videoId: string;
  stillSrc?: string;
  title: string;
  credit: string;
  /** Off where the caption's words are said beside it (a card's line). */
  caption?: boolean;
  className?: string;
}) => {
  const t = STRINGS[lang];
  const [playing, setPlaying] = useState(false);
  return (
    <figure className={className} data-playing={playing ? '' : undefined}>
      <div className={frame}>
        {playing ? (
          <iframe
            className={fill}
            src={youtubeEmbed(videoId)}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            {stillSrc === undefined ? null : (
              <Image
                src={stillSrc}
                alt=""
                fill
                unoptimized
                className={still}
                sizes="(min-width: 768px) 760px, 100vw"
              />
            )}
            <button
              type="button"
              className={button}
              onClick={() => setPlaying(true)}
              aria-label={t.play(title)}
            >
              <span className={play} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </button>
          </>
        )}
      </div>
      {withCaption ? <figcaption className={caption}>{t.videoCaption(credit)}</figcaption> : null}
    </figure>
  );
};
