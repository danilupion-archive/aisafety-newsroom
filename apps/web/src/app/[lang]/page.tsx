import type { Metadata } from 'next';

import Link from 'next/link';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { paths } from '@/i18n';
import { nextPage, readCursor } from '@/paging';
import { alternates, pageLang, type Query } from '@/params';
import { STRINGS } from '@/strings';
import { pageTitle } from '@/styles';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Query> };

const PAGE = 20;

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const lang = await pageLang(params);
  return {
    alternates: alternates(lang, paths.home(lang), {
      es: paths.home('es'),
      en: paths.home('en'),
      // `/` picks the reader's language.
      'x-default': '/',
    }),
  };
};

/** One language's latest breves and articles, then older ones page by page (SPEC §13 pages). */
const Home = async ({ params, searchParams }: Props) => {
  await connection();
  const lang = await pageLang(params);
  const t = STRINGS[lang];
  const after = readCursor(lang, await searchParams);
  const posts = await latestPosts(lang, { after, limit: PAGE });
  const last = posts.at(-1);
  return (
    <>
      <h1 className={pageTitle}>{after ? t.older : t.latest}</h1>
      {posts.length === 0 ? <p>{t.nothingYet}</p> : <PostList lang={lang} posts={posts} />}
      {posts.length === PAGE && last ? (
        <p>
          <Link href={nextPage(lang, paths.home(lang), last)}>{t.older}</Link>
        </p>
      ) : null}
    </>
  );
};

export default Home;
