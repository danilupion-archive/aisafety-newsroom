import Link from 'next/link';
import { connection } from 'next/server';

import { latestPosts } from '@/api';
import { PostList } from '@/components/PostList';
import { nextPage, readCursor } from '@/paging';
import { pageTitle } from '@/styles';

const PAGE = 20;

/** The latest breves and articles, then older ones page by page (SPEC §13 pages). */
const Home = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  await connection();
  const { antes, tras } = await searchParams;
  const after = readCursor(antes, tras);
  const posts = await latestPosts({ after, limit: PAGE });
  const last = posts.at(-1);
  return (
    <>
      <h1 className={pageTitle}>{after ? 'Publicaciones anteriores' : 'Lo último'}</h1>
      {posts.length === 0 ? <p>Todavía no hay publicaciones.</p> : <PostList posts={posts} />}
      {posts.length === PAGE && last ? (
        <p>
          <Link href={nextPage('/', last)}>Publicaciones anteriores</Link>
        </p>
      ) : null}
    </>
  );
};

export default Home;
