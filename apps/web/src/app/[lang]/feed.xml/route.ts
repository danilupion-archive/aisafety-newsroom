import { latestPosts } from '@/api';
import { atomFeed } from '@/feed';
import { isLang } from '@/i18n';
import { site } from '@/site';

export const dynamic = 'force-dynamic';

/** One language's Atom feed of its latest 50 posts (SPEC §13 pages); unpublished ones leave it with their pages (AC-7). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
): Promise<Response> {
  const { lang } = await params;
  if (!isLang(lang)) {
    return new Response('Not found', { status: 404 });
  }
  const { url, name, author } = site();
  const posts = await latestPosts(lang, { limit: 50 });
  return new Response(atomFeed(lang, { url, name: name[lang], author }, posts), {
    headers: {
      'content-type': 'application/atom+xml; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
}
