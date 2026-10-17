import { getPost } from '@/api';
import { isLang } from '@/i18n';
import { shareCard } from '@/og/card';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { isSlug } from '@/tags';

type Context = { params: Promise<{ path: string[] }> };

const notFound = () =>
  new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

/**
 * The share cards (R-WEB-14): `/og/<lang>.png` for a language's home and every page without its own, and
 * `/og/<lang>/<slug>.png` for a published post. A post the site doesn't show has none.
 */
export const GET = async (_request: Request, { params }: Context): Promise<Response> => {
  const { path } = await params;
  const config = site();
  const host = new URL(config.url).host;
  const [first = '', second, ...rest] = path;
  if (second === undefined) {
    const lang = first.replace(/\.png$/, '');
    if (!first.endsWith('.png') || !isLang(lang)) {
      return notFound();
    }
    const t = STRINGS[lang];
    return shareCard({ name: config.name[lang], title: t.tagline, footer: t.intro, host });
  }
  const slug = second.replace(/\.png$/, '');
  if (rest.length > 0 || !isLang(first) || !second.endsWith('.png') || !isSlug(slug)) {
    return notFound();
  }
  const post = await getPost(first, slug);
  if (post === undefined || post === 'gone') {
    return notFound();
  }
  const t = STRINGS[first];
  return shareCard({
    name: config.name[first],
    title: post.title,
    footer: post.type === 'page' ? t.tagline : t.type[post.type],
    host,
  });
};
