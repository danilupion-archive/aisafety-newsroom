import type { Metadata } from 'next';

import { renderMarkdown } from '@aisafety-newsroom/domain/markdown';
import { css } from '@styled-system/css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import type { Lang } from '@/i18n';

import { getPost, type Post } from '@/api';
import { LeadImage } from '@/components/LeadImage';
import { Sources } from '@/components/Sources';
import { Tags } from '@/components/Tags';
import { Translations } from '@/components/Translations';
import { VideoPlayer } from '@/components/VideoPlayer';
import { longDate, newsNote } from '@/format';
import { paths } from '@/i18n';
import { alternates, pageLang } from '@/params';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { column, label, pageTitle, prose, tagPill } from '@/styles';
import { isSlug, tagLabel } from '@/tags';
import { postVideo } from '@/video';

type Props = { params: Promise<{ lang: string; slug: string }> };

const back = css({
  display: 'inline-block',
  marginTop: '6',
  paddingY: '2.5',
  color: 'muted',
  fontWeight: '600',
  fontSize: '0.9375rem',
});
const kicker = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '3',
  marginTop: '3',
});
const kickerText = css({ color: 'muted' });
const summary = css({
  color: 'body',
  fontSize: { base: '1.1875rem', md: '1.375rem' },
  lineHeight: '1.5',
  marginBottom: '2',
});
const endRow = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  marginTop: '7',
  marginBottom: '4',
});

/** The post, or undefined: an unpublished one answers 410 from the proxy before it gets here (AC-7). */
const find = async (props: Props): Promise<{ lang: Lang; post: Post | undefined }> => {
  const lang = await pageLang(props.params);
  const { slug } = await props.params;
  const post = isSlug(slug) ? await getPost(lang, slug) : undefined;
  return { lang, post: post === 'gone' ? undefined : post };
};

/**
 * No metadata for a missing post: its page says not found, inside the language's layout. A notFound() thrown here
 * would skip that layout and land on the bare root page.
 */
export const generateMetadata = async (props: Props): Promise<Metadata> => {
  await connection();
  const { lang, post } = await find(props);
  if (!post) {
    return {};
  }
  const self = paths.post(lang, post.slug);
  const languages = Object.fromEntries([
    [lang, self],
    ...post.translations.map((translation) => [
      translation.lang,
      paths.post(translation.lang, translation.slug),
    ]),
  ]);
  return {
    title: post.title,
    description: post.summary || undefined,
    alternates: alternates(lang, self, post.translations.length === 0 ? {} : languages),
    // The post's own share card, never its lead image nor a source's (R-WEB-14).
    openGraph: {
      images: [
        { url: paths.shareCard(lang, post.slug), width: 1200, height: 630, alt: post.title },
      ],
      type: 'article',
      title: post.title,
      description: post.summary || undefined,
      url: self,
      siteName: site().name[lang],
      locale: STRINGS[lang].ogLocale,
      alternateLocale: post.translations.map((translation) => STRINGS[translation.lang].ogLocale),
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary || undefined,
      images: [paths.shareCard(lang, post.slug)],
    },
  };
};

/**
 * A breve or an article: its text, rendered safely (R-WEB-5), its sources with their access dates, its tags (R-WEB-1),
 * and its version in the other language (R-WEB-10), labelled in that language.
 */
const PostPage = async (props: Props) => {
  await connection();
  const { lang, post } = await find(props);
  if (!post) {
    notFound();
  }
  const t = STRINGS[lang];
  const [firstTag] = post.tags;
  // Posted on another day than its story happened: which day that was (R-WEB-13).
  const newsDay = newsNote(lang, post, 'long');
  const video = post.type === 'page' ? undefined : postVideo(post.sources);
  return (
    <article className={column}>
      <Link href={paths.home(lang)} className={back}>
        <span aria-hidden="true">← </span>
        {t.allEntries}
      </Link>
      <header>
        {post.type === 'page' ? null : (
          <p className={`${kicker} ${label}`}>
            {firstTag === undefined ? null : (
              <Link href={paths.tag(lang, firstTag)} className={tagPill}>
                {tagLabel(lang, firstTag)}
              </Link>
            )}
            <span className={kickerText}>
              {t.type[post.type]} ·{' '}
              <time dateTime={post.published_at}>{longDate(lang, post.published_at)}</time>
              {newsDay === undefined ? null : (
                <>
                  {' · '}
                  <time dateTime={post.news_date ?? undefined}>{newsDay}</time>
                </>
              )}
            </span>
          </p>
        )}
        <h1 className={pageTitle}>{post.title}</h1>
        {post.summary === '' ? null : <p className={summary}>{post.summary}</p>}
        {post.image ? (
          <LeadImage lang={lang} image={post.image} />
        ) : video ? (
          <VideoPlayer
            lang={lang}
            videoId={video.id}
            stillSrc={video.stillSrc}
            title={post.title}
            credit={video.credit}
          />
        ) : null}
      </header>
      <div className={prose} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
      <Sources lang={lang} sources={post.sources} />
      <footer className={endRow}>
        <Translations translations={post.translations} />
        <Tags lang={lang} tags={post.tags} />
      </footer>
    </article>
  );
};

export default PostPage;
