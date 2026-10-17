import { youtubeVideoId } from '@aisafety-newsroom/domain/url';

import type { Source } from './api';

import { imagePath } from './images';

/**
 * A source that is a YouTube video (R-WEB-12): its id, whatever form its address takes (watch, youtu.be, shorts,
 * live), or undefined for anything else.
 */
export const videoOf = (url: string): string | undefined => youtubeVideoId(url) ?? undefined;

/** The only host the site's policy lets into a frame (src/security.ts). */
export const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * YouTube's privacy-enhanced player for a video, starting as it loads: it only ever loads after a reader pressed
 * play, never on its own (R-WEB-7).
 */
export const youtubeEmbed = (id: string): string =>
  `${PLAYER_ORIGIN}/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;

/**
 * A post's video, for the player at its top (R-WEB-12): its first source that is a YouTube video, with that source's
 * preview as the still when the switches show it, credited to its channel.
 */
export const postVideo = (
  sources: readonly Source[],
): { id: string; stillSrc?: string; credit: string } | undefined => {
  for (const source of sources) {
    const id = videoOf(source.url);
    if (id !== undefined) {
      return {
        id,
        stillSrc: source.preview ? imagePath('preview', source.preview.sha256) : undefined,
        credit: source.preview?.credit ?? 'YouTube',
      };
    }
  }
  return undefined;
};
