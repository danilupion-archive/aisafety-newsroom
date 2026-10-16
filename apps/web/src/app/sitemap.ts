import type { MetadataRoute } from 'next';

import { allPosts } from '@/api';
import { LANGS, paths } from '@/i18n';
import { site } from '@/site';

export const dynamic = 'force-dynamic';

/**
 * Every published post in each language, and each language's home, topics and about pages, which say where their
 * other-language versions are (SPEC §13 pages). A post's own translations are in its page's head.
 */
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const { url } = site();
  const both = (page: (lang: (typeof LANGS)[number]) => string) =>
    LANGS.map((lang) => ({
      url: `${url}${page(lang)}`,
      alternates: {
        languages: Object.fromEntries(LANGS.map((other) => [other, `${url}${page(other)}`])),
      },
    }));
  const posts = await Promise.all(
    LANGS.map(async (lang) => ({ lang, posts: await allPosts(lang) })),
  );
  return [
    ...both(paths.home),
    ...both(paths.topics),
    ...both(paths.about),
    ...posts.flatMap(({ lang, posts: list }) =>
      list.map((post) => ({
        url: `${url}${paths.post(lang, post.slug)}`,
        lastModified: post.updated_at,
      })),
    ),
  ];
};

export default sitemap;
