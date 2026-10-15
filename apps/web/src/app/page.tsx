import Link from 'next/link';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { pageTitle } from '@/styles';

const PAGE = 20;

/** The latest breves and articles, then older ones page by page (SPEC §13 pages). */
const Home = async ({ searchParams }: { searchParams: Promise<{ antes?: string }> }) => {
  await connection();
  const { antes } = await searchParams;
  const before =
    antes !== undefined && !Number.isNaN(Date.parse(antes))
      ? new Date(antes).toISOString()
      : undefined;
  const posts = await latestPosts({ before, limit: PAGE });
  const last = posts.at(-1);
  return (
    <>
      <h1 className={pageTitle}>{before ? 'Publicaciones anteriores' : 'Lo último'}</h1>
      {posts.length === 0 ? <p>Todavía no hay publicaciones.</p> : <PostList posts={posts} />}
      {posts.length === PAGE && last ? (
        <p>
          <Link href={`/?antes=${encodeURIComponent(last.published_at)}`}>
            Publicaciones anteriores
          </Link>
        </p>
      ) : null}
    </>
  );
};

export default Home;
