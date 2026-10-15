import type { Metadata } from 'next';

import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { pageTitle } from '@/styles';
import { TAG, tagLabel } from '@/tags';

type Params = { params: Promise<{ tag: string }> };

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { tag } = await params;
  return { title: `Tema: ${tagLabel(tag)}`, alternates: { canonical: `/etiqueta/${tag}` } };
};

/** A tag's posts, latest first (SPEC §13 pages). */
const TagPage = async ({ params }: Params) => {
  await connection();
  const { tag } = await params;
  if (!TAG.test(tag)) {
    notFound();
  }
  const posts = await latestPosts({ tag, limit: 50 });
  if (posts.length === 0) {
    notFound();
  }
  return (
    <>
      <h1 className={pageTitle}>Tema: {tagLabel(tag)}</h1>
      <PostList posts={posts} />
    </>
  );
};

export default TagPage;
