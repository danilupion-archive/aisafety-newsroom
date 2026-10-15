import type { Metadata } from 'next';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { nextPage, readCursor } from '@/paging';
import { pageTitle } from '@/styles';
import { TAG, tagLabel } from '@/tags';

type Params = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE = 20;

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { tag } = await params;
  return { title: `Tema: ${tagLabel(tag)}`, alternates: { canonical: `/etiqueta/${tag}` } };
};

/** A tag's posts, latest first, page by page like the home page (SPEC §13 pages). */
const TagPage = async ({ params, searchParams }: Params) => {
  await connection();
  const { tag } = await params;
  if (!TAG.test(tag)) {
    notFound();
  }
  const { antes, tras } = await searchParams;
  const after = readCursor(antes, tras);
  const posts = await latestPosts({ tag, after, limit: PAGE });
  if (posts.length === 0 && !after) {
    notFound();
  }
  const last = posts.at(-1);
  return (
    <>
      <h1 className={pageTitle}>Tema: {tagLabel(tag)}</h1>
      {posts.length === 0 ? <p>No hay publicaciones anteriores.</p> : <PostList posts={posts} />}
      {posts.length === PAGE && last ? (
        <p>
          <Link href={nextPage(`/etiqueta/${tag}`, last)}>Publicaciones anteriores</Link>
        </p>
      ) : null}
    </>
  );
};

export default TagPage;
