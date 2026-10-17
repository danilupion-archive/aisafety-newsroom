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
// One row per source, no numbers (the text names its sources, never "source 2"), a thin rule between rows.
const list = css({
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  fontSize: '1.0625rem',
  lineHeight: '1.5',
  '& > li': { paddingY: '3' },
  '& > li + li': { borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rule' },
  '& > li:first-child': { paddingTop: '0' },
  '& > li:last-child': { paddingBottom: '0' },
  '& a': {
    textDecoration: 'underline',
    textDecorationColor: 'accent',
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.2em',
  },
});
const details = css({ display: 'block', color: 'muted', fontSize: '0.875rem', marginTop: '1' });
// A source with its outlet's preview: its text, then the image small on its right.
const withPreview = css({ display: 'flex', alignItems: 'flex-start', gap: '3.5' });
const grow = css({ flex: '1', minWidth: '0' });
// The outlet's wide preview in a 16:9 frame, never a square crop.
const thumb = css({
  flexShrink: '0',
  width: { base: '96px', md: '128px' },
  height: 'auto',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  borderRadius: 'md',
  bg: 'card',
});
const note = css({ color: 'muted', marginTop: '-1', marginBottom: '3.5' });

/**
 * A post's sources with the day each was consulted (R-WEB-1): no source, no claim. Above them, that the text is
 * AI-written from them (R-WEB-3). A source with its outlet's preview shows it small, credited to the outlet (R-WEB-16):
 * the site's own copy, which the API lists only while the switches show previews.
 */
export const Sources = ({
  lang,
  sources,
  note: aboveNote,
}: {
  lang: Lang;
  sources: readonly Source[];
  /** What the text is made from, above the list: the AI note, a translation's, or none for a signed text. */
  note?: string;
}) => {
  const t = STRINGS[lang];
  return sources.length === 0 ? null : (
    <section aria-labelledby="sources" className={box}>
      <h2 id="sources" className={sectionTitle}>
        {t.sources}
      </h2>
      {aboveNote === undefined ? null : <p className={note}>{aboveNote}</p>}
      <ol className={list}>
        {sources.map((source) => (
          <li key={source.url}>
            <div className={source.preview ? withPreview : undefined}>
              {/* The text first, the picture on its right. */}
              <span className={source.preview ? grow : undefined}>
                <a href={source.url} rel="noopener noreferrer">
                  {source.title}
                </a>
                <span className={details}>
                  {t.accessed(calendarDate(lang, source.accessed))}
                  {source.preview ? <> · {t.previewCredit(source.preview.credit)}</> : null}
                </span>
              </span>
              {source.preview ? (
                // The link beside it says what it is: the image only illustrates it.
                <Image
                  src={imagePath('preview', source.preview.sha256, 'thumb')}
                  alt=""
                  width={128}
                  height={72}
                  unoptimized
                  className={thumb}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
