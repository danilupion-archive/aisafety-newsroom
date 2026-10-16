import { css } from '@styled-system/css';

import type { Source } from '@/api';
import type { Lang } from '@/i18n';

import { calendarDate } from '@/format';
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
const note = css({ color: 'muted', marginTop: '-1', marginBottom: '3.5' });

/**
 * A post's sources with the day each was consulted (R-WEB-1): no source, no claim. Above them, that the text is
 * AI-written from them (R-WEB-3).
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
            <a href={source.url} rel="noopener noreferrer">
              {source.title}
            </a>{' '}
            <span className={accessed}>· {t.accessed(calendarDate(lang, source.accessed))}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
