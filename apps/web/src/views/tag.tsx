import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { paths } from '@/i18n';
import { nextPage, readCursor } from '@/paging';
import { STRINGS } from '@/strings';
import { pageTitle } from '@/styles';
import { tagLabel } from '@/tags';

import { readTag, type TagProps } from './tag-route';

const PAGE = 20;

/** A tag's posts in one language, latest first, page by page like the home page (SPEC §13 pages). */
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
    <>
      <h1 className={pageTitle}>{t.topic(tagLabel(lang, tag))}</h1>
      {posts.length === 0 ? <p>{t.noOlder}</p> : <PostList lang={lang} posts={posts} />}
      {posts.length === PAGE && last ? (
        <p>
          <Link href={nextPage(lang, paths.tag(lang, tag), last)}>{t.older}</Link>
        </p>
      ) : null}
    </>
  );
};
