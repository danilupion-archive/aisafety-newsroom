import { css } from '@styled-system/css';
import Link from 'next/link';

import type { PostSummary } from '@/api';
import type { Lang } from '@/i18n';

import { dateParts } from '@/format';
import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { label, typePill } from '@/styles';

import { Tags } from './Tags';

const list = css({ listStyle: 'none', padding: '0', margin: '0' });
// Wide: the date, the rail, the card side by side. On a phone: a narrow rail, the date above its card.
const entry = css({
  display: 'grid',
  gridTemplateColumns: { base: '14px minmax(0, 1fr)', md: '84px 20px minmax(0, 1fr)' },
  gridTemplateAreas: { base: '"rail date" "rail card"', md: '"date rail card"' },
  columnGap: { base: '3', md: '4' },
});
const date = css({
  gridArea: 'date',
  color: 'accent',
  textAlign: { base: 'left', md: 'right' },
  paddingTop: { base: '0', md: '4' },
  marginBottom: { base: '2', md: '0' },
  lineHeight: '1.3',
});
const dayMonth = css({ fontSize: { base: '0.9375rem', md: '1.25rem' } });
const weekday = css({
  display: { base: 'none', md: 'block' },
  color: 'muted',
  fontSize: '0.875rem',
  fontWeight: '400',
  letterSpacing: '0',
  textTransform: 'none',
});
const weekdayShort = css({ display: { base: 'inline', md: 'none' } });
const rail = css({
  gridArea: 'rail',
  position: 'relative',
  // The line through every entry, stopping at the last one's dot.
  _before: {
    content: '""',
    position: 'absolute',
    left: { base: '6px', md: '9px' },
    top: '0',
    bottom: '0',
    width: '2px',
    bg: 'rule',
  },
  '&[data-last]::before': { bottom: 'auto', height: { base: '12px', md: '22px' } },
});
const dot = css({
  position: 'absolute',
  left: { base: '0', md: '2px' },
  top: { base: '4px', md: '22px' },
  width: { base: '14px', md: '16px' },
  height: { base: '14px', md: '16px' },
  borderRadius: 'full',
  bg: 'accent',
  boxShadow: '0 0 0 4px token(colors.page)',
  '&[data-type=article]': { bg: 'text' },
});
const card = css({
  gridArea: 'card',
  minWidth: '0',
  marginBottom: '6',
  paddingX: { base: '4', md: '1.625rem' },
  paddingY: { base: '4', md: '5' },
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  borderRadius: 'xl',
  bg: 'card',
  '&[data-type=article]': { borderColor: 'muted' },
});
const pills = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' });
const title = css({
  fontSize: { base: '1.25rem', md: '1.5rem' },
  fontWeight: '700',
  lineHeight: '1.25',
  letterSpacing: '-0.01em',
  '&[data-featured]': { fontSize: { base: '1.5rem', md: '2rem' }, lineHeight: '1.15' },
});
const summary = css({
  color: 'body',
  fontSize: { base: '1rem', md: '1.0625rem' },
  lineHeight: '1.6',
  '&[data-featured]': { fontSize: { base: '1.0625rem', md: '1.1875rem' } },
});
const meta = css({ color: 'muted', fontSize: '0.9375rem' });
const read = css({ color: 'accent', fontWeight: '600' });

/** One timeline entry: its date, its dot on the rail, and its card. */
const Entry = ({
  lang,
  post,
  featured,
  last,
}: {
  lang: Lang;
  post: PostSummary;
  featured: boolean;
  last: boolean;
}) => {
  const t = STRINGS[lang];
  const parts = dateParts(lang, post.published_at);
  const href = paths.post(lang, post.slug);
  return (
    <li className={entry}>
      <time dateTime={post.published_at} className={`${date} ${label}`}>
        <span className={weekdayShort}>{parts.weekdayShort} </span>
        <span className={dayMonth}>
          {parts.day} {parts.month}
        </span>
        <span className={weekday}>{parts.weekday}</span>
      </time>
      <div className={rail} data-last={last ? '' : undefined} aria-hidden="true">
        <span className={dot} data-type={post.type} />
      </div>
      <article className={card} data-type={post.type}>
        <div className={pills}>
          <Tags lang={lang} tags={post.tags} />
          <span className={typePill} data-type={post.type}>
            {t.type[post.type]}
          </span>
        </div>
        <h2 className={title} data-featured={featured ? '' : undefined}>
          <Link href={href}>{post.title}</Link>
        </h2>
        {post.summary === '' ? null : (
          <p className={summary} data-featured={featured ? '' : undefined}>
            {post.summary}
          </p>
        )}
        <p className={meta}>
          {typeof post.source_count === 'number' ? (
            <>{t.sourceCount(post.source_count)} · </>
          ) : null}
          <Link href={href} className={read} aria-label={`${t.read}: ${post.title}`}>
            {t.read}
          </Link>
        </p>
      </article>
    </li>
  );
};

/**
 * Posts as a timeline, latest first (SPEC §13 pages): the date in the page's language, a dot per entry on the rail
 * (orange for a breve, light for an article), and each post's card. The newest entry of the first page is larger.
 */
export const Timeline = ({
  lang,
  posts,
  featureFirst,
}: {
  lang: Lang;
  posts: readonly PostSummary[];
  featureFirst: boolean;
}) => (
  <ol className={list}>
    {posts.map((post, index) => (
      <Entry
        key={post.slug}
        lang={lang}
        post={post}
        featured={featureFirst && index === 0}
        last={index === posts.length - 1}
      />
    ))}
  </ol>
);
