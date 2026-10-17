import { css } from '@styled-system/css';

import type { Lang } from '@/i18n';

import { calendarDate } from '@/format';
import { platformOf, type Quote } from '@/quotes';
import { STRINGS } from '@/strings';

const card = css({
  position: 'relative',
  marginTop: '7',
  paddingLeft: { base: '5', md: '6' },
  paddingRight: { base: '4', md: '6' },
  paddingY: '5',
  borderRadius: 'xl',
  bg: 'card',
  borderLeftWidth: '3px',
  borderLeftStyle: 'solid',
  borderLeftColor: 'accent',
});
const words = css({
  color: 'text',
  fontSize: { base: '1.1875rem', md: '1.3125rem' },
  lineHeight: '1.45',
  fontWeight: '600',
  '&::before': { content: '"“"', color: 'accent' },
  '&::after': { content: '"”"', color: 'accent' },
});
const translated = css({ marginTop: '3', color: 'body', fontSize: '1rem', lineHeight: '1.55' });
const translatedLabel = css({ color: 'muted', fontSize: '0.875rem' });
// Who, where and when, and the link: one per line on a phone, where separators would strand at line ends; in a row on
// wider screens, each after the first led by a middle dot.
const caption = css({
  marginTop: '4',
  display: 'flex',
  flexDirection: { base: 'column', md: 'row' },
  flexWrap: 'wrap',
  alignItems: { base: 'flex-start', md: 'baseline' },
  columnGap: '2',
  rowGap: '1',
  color: 'muted',
  fontSize: '0.9375rem',
  md: { '& > * + *::before': { content: '"·"', marginRight: '2' } },
});
const handle = css({ marginLeft: '2' });
const who = css({ color: 'text', fontWeight: '700' });
const link = css({ color: 'accent', fontWeight: '600' });

/**
 * A quotation from someone's post, drawn by the site (R-WEB-17, D21): the words as text, who said them, where and
 * when, a link to the original, and our translation when they were said in another language. Nothing loads from the
 * platform: no avatar, no embed, no script.
 */
export const QuoteCard = ({ lang, quote }: { lang: Lang; quote: Quote }) => {
  const t = STRINGS[lang];
  const platform = platformOf(quote.url);
  return (
    <figure className={card}>
      <blockquote cite={quote.url}>
        <p className={words}>{quote.text}</p>
      </blockquote>
      {quote.translation === undefined ? null : (
        <p className={translated}>
          <span className={translatedLabel}>{t.ourTranslation}: </span>
          {quote.translation}
        </p>
      )}
      <figcaption className={caption}>
        <span>
          <span className={who}>{quote.author}</span>
          {quote.handle === undefined ? null : <span className={handle}>{quote.handle}</span>}
        </span>
        <span>
          {platform}, <time dateTime={quote.date}>{calendarDate(lang, quote.date)}</time>
        </span>
        <a className={link} href={quote.url} rel="noopener noreferrer">
          {t.viewOn(platform)}
        </a>
      </figcaption>
    </figure>
  );
};
