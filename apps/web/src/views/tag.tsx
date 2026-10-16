import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { FeedBox } from '@/components/FeedBox';
import { Timeline } from '@/components/Timeline';
import { paths } from '@/i18n';
import { nextPage, readCursor } from '@/paging';
import { STRINGS } from '@/strings';
import { container, pageTitle } from '@/styles';
import { tagLabel } from '@/tags';

import { readTag, type TagProps } from './tag-route';

const PAGE = 20;

/** A tag's posts in one language as a timeline, latest first, page by page like the home page (SPEC §13 pages). */
export const TagView = async ({ word, params, searchParams }: TagProps & { word: string }) => {
  await connection();
  const { lang, tag } = await readTag(word, params);
  const t = STRINGS[lang];
  const after = readCursor(lang, await searchParams);
  const posts = await latestPosts(lang, { tag, after, limit: PAGE });
  if (posts.length === 0 && !after) {
    notFound();
  }
  const last = posts.at(-1);
  return (
    <div className={container}>
      <h1 className={pageTitle}>{t.topic(tagLabel(lang, tag))}</h1>
      {posts.length === 0 ? (
        <p>{t.noOlder}</p>
      ) : (
        <Timeline lang={lang} posts={posts} featureFirst={false} />
      )}
      <FeedBox
        lang={lang}
        older={
          posts.length === PAGE && last ? nextPage(lang, paths.tag(lang, tag), last) : undefined
        }
      />
    </div>
  );
};
