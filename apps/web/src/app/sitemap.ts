import type { MetadataRoute } from 'next';

import { allPosts, entityList } from '@/api';
import { LANGS, paths } from '@/i18n';
import { site } from '@/site';

export const dynamic = 'force-dynamic';

/**
 * Every published post in each language, and each language's home, topics, who's who and about pages, which say where
 * their other-language versions are (SPEC §13 pages); and each entity's page (R-WEB-20), with its other language where
 * a story there names it too. A post's own translations are in its page's head.
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
  const entities = await Promise.all(
    LANGS.map(async (lang) => ({
      lang,
      ids: new Set((await entityList(lang)).map((entity) => entity.id)),
    })),
  );
  return [
    ...both(paths.home),
    ...both(paths.topics),
    ...both(paths.entities),
    ...both(paths.about),
    ...entities.flatMap(({ lang, ids }) =>
      [...ids].map((id) => ({
        url: `${url}${paths.entity(lang, id)}`,
        alternates: {
          languages: Object.fromEntries(
            entities
              .filter((other) => other.ids.has(id))
              .map((other) => [other.lang, `${url}${paths.entity(other.lang, id)}`]),
          ),
        },
      })),
    ),
    ...posts.flatMap(({ lang, posts: list }) =>
      list.map((post) => ({
        url: `${url}${paths.post(lang, post.slug)}`,
        lastModified: post.updated_at,
      })),
    ),
  ];
};

export default sitemap;
