import { latestPosts } from '@/api';
import { atomFeed } from '@/feed';
import { site } from '@/site';

export const dynamic = 'force-dynamic';

/** The Atom feed of the latest 50 posts (SPEC §13 pages); unpublished ones leave it with their pages (AC-7). */
export async function GET(): Promise<Response> {
  const posts = await latestPosts({ limit: 50 });
  return new Response(atomFeed(site(), posts), {
    headers: {
      'content-type': 'application/atom+xml; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
}
