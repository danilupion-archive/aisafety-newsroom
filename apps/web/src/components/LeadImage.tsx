import { css } from '@styled-system/css';
import Image from 'next/image';

import type { PostImage } from '@/api';
import type { Lang } from '@/i18n';

import { imagePath } from '@/images';
import { STRINGS } from '@/strings';

const figure = css({ marginTop: '6', marginBottom: '2' });
const picture = css({
  display: 'block',
  width: '100%',
  height: 'auto',
  borderRadius: 'xl',
  bg: 'card',
});
const caption = css({
  marginTop: '2.5',
  color: 'muted',
  fontSize: '0.9375rem',
  lineHeight: '1.5',
  '& a': { textDecoration: 'underline', textUnderlineOffset: '0.2em' },
});

/**
 * A post's lead image (R-WEB-15): an image under a clear licence, the site's own copy, with its alt text and a caption
 * that credits it, links to where it came from, and names its licence.
 */
export const LeadImage = ({ lang, image }: { lang: Lang; image: PostImage }) => (
  <figure className={figure}>
    {/* The API's own re-encoding, already sized: nothing for Next's optimiser to do. */}
    <Image
      src={imagePath('lead', image.sha256)}
      alt={image.alt}
      width={image.width}
      height={image.height}
      unoptimized
      preload
      className={picture}
    />
    <figcaption className={caption}>
      {STRINGS[lang].imageCredit}{' '}
      <a href={image.source_url} rel="noopener noreferrer">
        {image.credit}
      </a>{' '}
      · {image.licence}
    </figcaption>
  </figure>
);
