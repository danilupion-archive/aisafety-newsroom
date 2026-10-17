import type { Metadata } from 'next';

import { css } from '@styled-system/css';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { ContinuousTimeline } from '@/components/ContinuousTimeline';
import { FeedBox } from '@/components/FeedBox';
import { OrderSwitch } from '@/components/OrderSwitch';
import { readShown } from '@/continuous';
import { DEFAULT_LANG, paths } from '@/i18n';
import { nextPage, readCursor, readOrder } from '@/paging';
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

/**
 * One language's latest breves and articles as a timeline, then older ones page by page (SPEC §13 pages): as posted,
 * or by the day each story happened (R-WEB-13).
 */
const Home = async ({ params, searchParams }: Props) => {
  await connection();
  const lang = await pageLang(params);
  const t = STRINGS[lang];
  const query = await searchParams;
  const order = readOrder(lang, query);
  const after = readCursor(lang, query, order);
  // Back to a continuous timeline (R-WEB-19): as many posts as the reader had, bounded; a page's worth otherwise.
  const limit = after ? PAGE : (readShown(lang, query) ?? PAGE);
  const posts = await latestPosts(lang, { after, limit, order });
  const last = posts.at(-1);
  const home = paths.home(lang);
  return (
    <div className={container}>
      {after ? (
        <h1 className={pageTitle}>{t.older}</h1>
      ) : (
        <>
          <h1 className={srOnly}>{order === 'news' ? t.orderNews : t.latest}</h1>
          <p className={intro}>{t.intro}</p>
        </>
      )}
      {posts.length === 0 && !after ? null : <OrderSwitch lang={lang} path={home} order={order} />}
      {posts.length === 0 ? (
        <p>{after ? t.noOlder : t.nothingYet}</p>
      ) : (
        <ContinuousTimeline
          lang={lang}
          path={home}
          order={order}
          initial={posts}
          more={posts.length === limit}
          featureFirst={!after}
        />
      )}
      <FeedBox
        lang={lang}
        older={posts.length === limit && last ? nextPage(lang, home, last, order) : undefined}
      />
    </div>
  );
};

export default Home;
