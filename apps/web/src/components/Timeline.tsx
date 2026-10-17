import { css } from '@styled-system/css';
import Link from 'next/link';

import type { PostSummary, Segment } from '@/api';
import type { Lang } from '@/i18n';
import type { Order } from '@/paging';

import { bylineOf } from '@/byline';
import { Pending } from '@/components/Pending';
import { VideoPlayer } from '@/components/VideoPlayer';
import { calendarParts, dateParts, newsNote } from '@/format';
import { paths } from '@/i18n';
import { cardImage } from '@/images';
import { STRINGS } from '@/strings';
import { authorPill, label, typePill } from '@/styles';

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
  // A breve's dot is a highlight (R-WEB-11): pink, glowing; an article's is light.
  bg: 'highlight',
  boxShadow: '0 0 0 4px token(colors.page), 0 0 12px token(colors.highlightGlow)',
  '&[data-type=article]': { bg: 'text', boxShadow: '0 0 0 4px token(colors.page)' },
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
// With a picture (its lead image, or else its first source's preview): beside the pills and the title, which wrap.
// On a phone the picture spans the card above the text; wider, it sits on the text's right. A video that plays wraps
// below the text, at the card's whole width.
// On a phone the picture spans the card above the text. Wider, it floats on the right: the title and the summary run
// beside it and, when longer, on under it at the card's full width. A video that plays takes the whole width.
const head = css({
  display: { base: 'flex', md: 'flow-root' },
  flexDirection: 'column',
  gap: '3.5',
});
const pictureSlot = css({
  display: 'block',
  width: { base: '100%', md: '220px' },
  md: { float: 'right', marginLeft: '5', marginBottom: '2' },
});
const videoSlot = css({
  width: { base: '100%', md: '220px' },
  md: {
    float: 'right',
    marginLeft: '5',
    marginBottom: '2',
    '&[data-playing]': { float: 'none', width: '100%', marginLeft: '0', marginBottom: '4' },
  },
});
const headText = css({
  display: { base: 'flex', md: 'block' },
  flexDirection: 'column',
  gap: '2.5',
  minWidth: '0',
  md: { '& > * + *': { marginTop: '2.5' } },
});
// Outlets make their previews wide (about 1.9:1): a 16:9 frame shows most of one, never a square crop.
const thumb = css({
  width: '100%',
  height: 'auto',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  borderRadius: 'lg',
  bg: 'deep',
});
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
// The card's footer: set apart from the story by a rule, smaller and dimmer than the summary, its action on the right.
const meta = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: '4',
  rowGap: '2',
  marginTop: '1',
  paddingTop: '3',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'rule',
  color: 'muted',
  fontSize: '0.8125rem',
  lineHeight: '1.5',
});
const metaDetails = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5' });
// "Escrito con IA": a small label, told apart from the details beside it.
const aiChip = css({
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'full',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  color: 'body',
  fontWeight: '600',
  fontSize: '0.75rem',
  letterSpacing: '0.02em',
});
// A search result's matched words (R-WEB-18).
const hit = css({ bg: 'accentSoft', color: 'text', borderRadius: 'sm', paddingX: '0.5' });

/** A post as a timeline shows it; a search result also carries the excerpt where it matched (R-WEB-18). */
type Listed = PostSummary & { excerpt?: readonly Segment[] };
const read = css({
  color: 'accent',
  fontWeight: '700',
  fontSize: '0.9375rem',
  whiteSpace: 'nowrap',
});

/** One timeline entry: its date, its dot on the rail, and its card. */
const Entry = ({
  lang,
  post,
  order,
  featured,
  last,
}: {
  lang: Lang;
  post: Listed;
  order: Order;
  featured: boolean;
  last: boolean;
}) => {
  const t = STRINGS[lang];
  // The order's own date: the day the story happened in news order, the day it was posted otherwise.
  const byNews = order === 'news' && typeof post.news_date === 'string';
  const parts = byNews
    ? calendarParts(lang, post.news_date ?? '')
    : dateParts(lang, post.published_at);
  // As posted, a story that happened on another day says which.
  const note = byNews ? undefined : newsNote(lang, post);
  const picture = cardImage(post);
  const byline = bylineOf(post);
  const href = paths.post(lang, post.slug);
  return (
    <li className={entry}>
      <time
        dateTime={byNews ? (post.news_date ?? undefined) : post.published_at}
        className={`${date} ${label}`}
      >
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
        <div className={head}>
          {picture?.video !== undefined ? (
            // In the picture's place until played; playing, it takes the card's whole width (R-WEB-12).
            <VideoPlayer
              lang={lang}
              videoId={picture.video}
              stillSrc={picture.src}
              title={post.title}
              credit={picture.credit ?? 'YouTube'}
              caption={false}
              className={videoSlot}
            />
          ) : picture ? (
            // The title is the link; the picture only illustrates it (R-WEB-15, R-WEB-16). The full image across a
            // phone's card, the thumbnail beside the title on a wider screen.
            <picture className={pictureSlot}>
              <source media="(min-width: 768px)" srcSet={picture.thumbSrc} />
              {/* oxlint-disable-next-line next/no-img-element -- a <picture> with two sizes; next/image has none */}
              <img
                src={picture.src}
                alt=""
                width={480}
                height={270}
                loading="lazy"
                decoding="async"
                className={thumb}
              />
            </picture>
          ) : null}
          <div className={headText}>
            <div className={pills}>
              <Tags lang={lang} tags={post.tags} />
              <span className={typePill} data-type={post.type}>
                {t.type[post.type]}
              </span>
              {byline.kind === 'ai' ? null : (
                // A signed post shows its writer (R-WEB-3, D19).
                <span className={authorPill}>{t.writtenBy(byline.author)}</span>
              )}
            </div>
            <h2 className={title} data-featured={featured ? '' : undefined}>
              <Link href={href}>
                {post.title}
                <Pending />
              </Link>
            </h2>
            {post.excerpt !== undefined && post.excerpt.length > 0 ? (
              // Where it matched, the matched words marked: plain text, escaped like any other.
              <p className={summary}>
                {post.excerpt.map((segment, index) =>
                  segment.match ? (
                    <mark key={index} className={hit}>
                      {segment.text}
                    </mark>
                  ) : (
                    segment.text
                  ),
                )}
              </p>
            ) : post.summary === '' ? null : (
              <p className={summary} data-featured={featured ? '' : undefined}>
                {post.summary}
              </p>
            )}
          </div>
        </div>
        <footer className={meta}>
          <span className={metaDetails}>
            {/* Every AI-written post says so where a reader first meets it (R-WEB-3, D19). */}
            {byline.kind === 'ai' ? <span className={aiChip}>{t.aiLabel}</span> : null}
            {byline.kind === 'translation' ? (
              <span className={aiChip}>{t.aiTranslation}</span>
            ) : null}
            {[
              note,
              typeof post.source_count === 'number' ? t.sourceCount(post.source_count) : undefined,
              picture?.credit === undefined
                ? undefined
                : picture.video === undefined
                  ? t.previewCredit(picture.credit)
                  : t.videoCaption(picture.credit),
            ]
              .filter((part): part is string => part !== undefined)
              .join(' · ')}
          </span>
          <Link href={href} className={read} aria-label={`${t.read}: ${post.title}`}>
            {t.read} →
            <Pending />
          </Link>
        </footer>
      </article>
    </li>
  );
};

/**
 * Posts as a timeline, latest first (SPEC §13 pages): the date in the page's language, a dot per entry on the rail
 * (pink for a breve, light for an article), and each post's card. The newest entry of the first page is larger. In
 * news order (R-WEB-13) the date is the day each story happened.
 */
export const Timeline = ({
  lang,
  posts,
  order = 'posted',
  featureFirst,
}: {
  lang: Lang;
  posts: readonly Listed[];
  order?: Order;
  featureFirst: boolean;
}) => (
  <ol className={list}>
    {posts.map((post, index) => (
      <Entry
        key={post.slug}
        lang={lang}
        post={post}
        order={order}
        featured={featureFirst && index === 0}
        last={index === posts.length - 1}
      />
    ))}
  </ol>
);
