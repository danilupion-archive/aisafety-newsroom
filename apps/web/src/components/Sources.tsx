import { css } from '@styled-system/css';
import Image from 'next/image';

import type { Source } from '@/api';
import type { Lang } from '@/i18n';

import { calendarDate } from '@/format';
import { imagePath } from '@/images';
import { STRINGS } from '@/strings';
import { sectionTitle } from '@/styles';

const box = css({
  marginTop: '9',
  paddingX: { base: '5', md: '1.625rem' },
  paddingY: '1.375rem',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  bg: 'deep',
});
const list = css({
  listStyle: 'decimal',
  paddingLeft: '5',
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5',
  fontSize: '1.0625rem',
  lineHeight: '1.5',
  '& a': {
    textDecoration: 'underline',
    textDecorationColor: 'accent',
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.2em',
  },
});
const accessed = css({ color: 'muted' });
// A source with its outlet's preview: the image small beside its text, which wraps next to it.
const withPreview = css({ display: 'flex', alignItems: 'flex-start', gap: '3.5' });
const thumb = css({
  flexShrink: '0',
  width: { base: '72px', md: '96px' },
  height: { base: '54px', md: '72px' },
  objectFit: 'cover',
  borderRadius: 'md',
  bg: 'card',
});
const credit = css({ display: 'block', color: 'muted', fontSize: '0.875rem', marginTop: '0.5' });
const note = css({ color: 'muted', marginTop: '-1', marginBottom: '3.5' });

/**
 * A post's sources with the day each was consulted (R-WEB-1): no source, no claim. Above them, that the text is
 * AI-written from them (R-WEB-3). A source with its outlet's preview shows it small, credited to the outlet (R-WEB-16):
 * the site's own copy, which the API lists only while the switches show previews.
 */
export const Sources = ({ lang, sources }: { lang: Lang; sources: readonly Source[] }) => {
  const t = STRINGS[lang];
  return sources.length === 0 ? null : (
    <section aria-labelledby="sources" className={box}>
      <h2 id="sources" className={sectionTitle}>
        {t.sources}
      </h2>
      <p className={note}>{t.aiNote}</p>
      <ol className={list}>
        {sources.map((source) => (
          <li key={source.url}>
            <div className={source.preview ? withPreview : undefined}>
              {source.preview ? (
                // The link beside it says what it is: the image only illustrates it.
                <Image
                  src={imagePath('preview', source.preview.sha256, 'thumb')}
                  alt=""
                  width={96}
                  height={72}
                  unoptimized
                  className={thumb}
                />
              ) : null}
              <span>
                <a href={source.url} rel="noopener noreferrer">
                  {source.title}
                </a>{' '}
                <span className={accessed}>
                  · {t.accessed(calendarDate(lang, source.accessed))}
                </span>
                {source.preview ? (
                  <span className={credit}>{t.previewCredit(source.preview.credit)}</span>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
