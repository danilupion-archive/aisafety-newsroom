import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { FeedBox } from '@/components/FeedBox';
import { OrderSwitch } from '@/components/OrderSwitch';
import { Timeline } from '@/components/Timeline';
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
  const posts = await latestPosts(lang, { tag, after, limit: PAGE, order });
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
        <Timeline lang={lang} posts={posts} order={order} featureFirst={false} />
      )}
      <FeedBox
        lang={lang}
        older={posts.length === PAGE && last ? nextPage(lang, path, last, order) : undefined}
      />
    </div>
  );
};
