import { youtubeVideoId } from '@aisafety-newsroom/domain/url';

import type { PostSummary } from './api';

/**
 * The site's own copies of images (D17): a post's lead image (R-WEB-15) and its sources' previews (R-WEB-16), served
 * from the site's host under `/img/`, so a reader's browser loads nothing from another (R-WEB-7). The API decides on
 * every request whether one may be served (the switches, removals, a published post naming it); the file is the same
 * bytes for as long as its name, its SHA-256, lasts, so browsers may keep it.
 */

export type ImageKind = 'lead' | 'preview';
export type ImageSize = 'full' | 'thumb';

/** An image's address on the site: `/img/<kind>/<sha256>.webp`, `.thumb.webp` for the small one. */
export const imagePath = (kind: ImageKind, sha256: string, size: ImageSize = 'full'): string =>
  `/img/${kind}/${sha256}${size === 'thumb' ? '.thumb' : ''}.webp`;

const FILE = /^([0-9a-f]{64})(\.thumb)?\.webp$/;

/** The image an address under `/img/` names, or undefined for anything else. */
export const readImagePath = (
  kind: string,
  file: string,
): { kind: ImageKind; sha256: string; size: ImageSize } | undefined => {
  const match = FILE.exec(file);
  if ((kind !== 'lead' && kind !== 'preview') || match?.[1] === undefined) {
    return undefined;
  }
  return { kind, sha256: match[1], size: match[2] === undefined ? 'full' : 'thumb' };
};

/**
 * A served image's cache: a week, unchanging. Taken down, an image leaves every page at once (the API stops naming it)
 * and its address answers 404; a browser that already has it keeps its copy.
 */
export const IMAGE_CACHE = 'public, max-age=604800, immutable';

/**
 * A card's picture: its post's lead image (R-WEB-15), or else its first source's preview (R-WEB-16), which names its
 * outlet as every preview does; when that source is a YouTube video, its still becomes its player (R-WEB-12), at full
 * size. Undefined when the post has neither or the switches hide them.
 */
export const cardImage = (
  post: Pick<PostSummary, 'image' | 'preview'>,
): { src: string; thumbSrc: string; credit?: string; video?: string } | undefined => {
  if (post.image) {
    const { sha256 } = post.image;
    return { src: imagePath('lead', sha256), thumbSrc: imagePath('lead', sha256, 'thumb') };
  }
  if (post.preview) {
    const { sha256, credit, source_url } = post.preview;
    const video = source_url === undefined ? undefined : (youtubeVideoId(source_url) ?? undefined);
    const paths = {
      src: imagePath('preview', sha256),
      thumbSrc: imagePath('preview', sha256, 'thumb'),
    };
    return video === undefined ? { ...paths, credit } : { ...paths, credit, video };
  }
  return undefined;
};
