import type { Metadata } from 'next';

import { renderMarkdown } from '@aisafety-newsroom/domain/markdown';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { getPost, type Post } from '@/api';
import { Tags } from '@/components/Tags';
import { calendarDate, longDate, TYPE_LABEL } from '@/format';
import { site } from '@/site';
import { muted, pageTitle, prose, sectionTitle } from '@/styles';
import { TAG } from '@/tags';

type Params = { params: Promise<{ slug: string }> };

/** The post, or nothing: an unpublished one answers 410 from the proxy before it gets here (AC-7). */
const load = async (slug: string): Promise<Post> => {
  if (!TAG.test(slug)) {
    notFound();
  }
  const post = await getPost(slug);
  if (post === undefined || post === 'gone') {
    notFound();
  }
  return post;
};

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  await connection();
  const post = await load((await params).slug);
  const { name } = site();
  return {
    title: post.title,
    description: post.summary || undefined,
    alternates: { canonical: `/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary || undefined,
      url: `/${post.slug}`,
      siteName: name,
      locale: 'es_ES',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      tags: post.tags,
    },
  };
};

/** A breve or an article: its text, rendered safely (R-WEB-5), its sources with their access dates, its tags (R-WEB-1). */
const PostPage = async ({ params }: Params) => {
  await connection();
  const post = await load((await params).slug);
  return (
    <article>
      <header>
        {post.type === 'page' ? null : (
          <p className={muted}>
            {TYPE_LABEL[post.type]} ·{' '}
            <time dateTime={post.published_at}>{longDate(post.published_at)}</time>
          </p>
        )}
        <h1 className={pageTitle}>{post.title}</h1>
      </header>
      <div className={prose} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
      {post.sources.length === 0 ? null : (
        <section aria-labelledby="fuentes">
          <h2 id="fuentes" className={sectionTitle}>
            Fuentes
          </h2>
          <ol>
            {post.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} rel="noopener noreferrer">
                  {source.title}
                </a>{' '}
                <span className={muted}>(consultado el {calendarDate(source.accessed)})</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Tags tags={post.tags} />
    </article>
  );
};

export default PostPage;
