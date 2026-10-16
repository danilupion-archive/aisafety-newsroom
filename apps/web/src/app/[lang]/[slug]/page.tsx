import type { Metadata } from 'next';

import { renderMarkdown } from '@aisafety-newsroom/domain/markdown';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import type { Lang } from '@/i18n';

import { getPost, type Post } from '@/api';
import { Tags } from '@/components/Tags';
import { Translations } from '@/components/Translations';
import { calendarDate, longDate } from '@/format';
import { paths } from '@/i18n';
import { alternates, pageLang } from '@/params';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { muted, pageTitle, prose, sectionTitle } from '@/styles';
import { isSlug } from '@/tags';

type Props = { params: Promise<{ lang: string; slug: string }> };

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
    openGraph: {
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
  };
};

/**
 * A breve or an article: its text, rendered safely (R-WEB-5), its sources with their access dates, its tags (R-WEB-1),
 * and its versions in the other language (R-WEB-10), each labelled in its own language.
 */
const PostPage = async (props: Props) => {
  await connection();
  const { lang, post } = await find(props);
  if (!post) {
    notFound();
  }
  const t = STRINGS[lang];
  return (
    <article>
      <header>
        {post.type === 'page' ? null : (
          <p className={muted}>
            {t.type[post.type]} ·{' '}
            <time dateTime={post.published_at}>{longDate(lang, post.published_at)}</time>
          </p>
        )}
        <h1 className={pageTitle}>{post.title}</h1>
        <Translations translations={post.translations} />
      </header>
      <div className={prose} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
      {post.sources.length === 0 ? null : (
        <section aria-labelledby="sources">
          <h2 id="sources" className={sectionTitle}>
            {t.sources}
          </h2>
          <ol>
            {post.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} rel="noopener noreferrer">
                  {source.title}
                </a>{' '}
                <span className={muted}>({t.accessed(calendarDate(lang, source.accessed))})</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Tags lang={lang} tags={post.tags} />
    </article>
  );
};

export default PostPage;
