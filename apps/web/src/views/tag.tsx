import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { ContinuousTimeline } from '@/components/ContinuousTimeline';
import { FeedBox } from '@/components/FeedBox';
import { OrderSwitch } from '@/components/OrderSwitch';
import { readShown } from '@/continuous';
import { paths } from '@/i18n';
import { nextPage, readCursor, readOrder } from '@/paging';
import { STRINGS } from '@/strings';
import { container, pageTitle } from '@/styles';
import { tagLabel } from '@/tags';

import { readTag, type TagProps } from './tag-route';

const PAGE = 20;

/**
 * A tag's posts in one language as a timeline, latest first, page by page like the home page (SPEC §13 pages), and in
 * news order like it too (R-WEB-13).
 */
export const TagView = async ({ word, params, searchParams }: TagProps & { word: string }) => {
  await connection();
  const { lang, tag } = await readTag(word, params);
  const t = STRINGS[lang];
  const query = await searchParams;
  const order = readOrder(lang, query);
  const after = readCursor(lang, query, order);
  // Back to a continuous timeline (R-WEB-19): as many posts as the reader had, bounded; a page's worth otherwise.
  const limit = after ? PAGE : (readShown(lang, query) ?? PAGE);
  const posts = await latestPosts(lang, { tag, after, limit, order });
  if (posts.length === 0 && !after) {
    notFound();
  }
  const last = posts.at(-1);
  const path = paths.tag(lang, tag);
  return (
    <div className={container}>
      <h1 className={pageTitle}>{t.topic(tagLabel(lang, tag))}</h1>
      <OrderSwitch lang={lang} path={path} order={order} />
      {posts.length === 0 ? (
        <p>{t.noOlder}</p>
      ) : (
        <ContinuousTimeline
          // A new order or topic is a new list: the posts already loaded must not carry over.
          key={`${tag}:${order}`}
          lang={lang}
          path={path}
          order={order}
          tag={tag}
          initial={posts}
          more={posts.length === limit}
          featureFirst={false}
        />
      )}
      <FeedBox
        lang={lang}
        older={posts.length === limit && last ? nextPage(lang, path, last, order) : undefined}
      />
    </div>
  );
};
