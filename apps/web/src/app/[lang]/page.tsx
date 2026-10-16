import type { Metadata } from 'next';

import { css } from '@styled-system/css';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { FeedBox } from '@/components/FeedBox';
import { Timeline } from '@/components/Timeline';
import { DEFAULT_LANG, paths } from '@/i18n';
import { nextPage, readCursor } from '@/paging';
import { alternates, pageLang, type Query } from '@/params';
import { STRINGS } from '@/strings';
import { container, pageTitle, srOnly } from '@/styles';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Query> };

const PAGE = 20;

const intro = css({
  maxWidth: '41rem',
  marginTop: { base: '6', md: '10' },
  marginBottom: { base: '6', md: '9' },
  color: 'muted',
  fontSize: { base: '1.25rem', md: '1.375rem' },
  lineHeight: '1.45',
});

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const lang = await pageLang(params);
  return {
    alternates: alternates(lang, paths.home(lang), {
      es: paths.home('es'),
      en: paths.home('en'),
      // Spanish, at the root, for every other reader.
      'x-default': paths.home(DEFAULT_LANG),
    }),
  };
};

/** One language's latest breves and articles as a timeline, then older ones page by page (SPEC §13 pages). */
const Home = async ({ params, searchParams }: Props) => {
  await connection();
  const lang = await pageLang(params);
  const t = STRINGS[lang];
  const after = readCursor(lang, await searchParams);
  const posts = await latestPosts(lang, { after, limit: PAGE });
  const last = posts.at(-1);
  return (
    <div className={container}>
      {after ? (
        <h1 className={pageTitle}>{t.older}</h1>
      ) : (
        <>
          <h1 className={srOnly}>{t.latest}</h1>
          <p className={intro}>{t.intro}</p>
        </>
      )}
      {posts.length === 0 ? (
        <p>{after ? t.noOlder : t.nothingYet}</p>
      ) : (
        <Timeline lang={lang} posts={posts} featureFirst={!after} />
      )}
      <FeedBox
        lang={lang}
        older={posts.length === PAGE && last ? nextPage(lang, paths.home(lang), last) : undefined}
      />
    </div>
  );
};

export default Home;
