import type { MetadataRoute } from 'next';

import { allPosts } from '@/api';
import { site } from '@/site';

export const dynamic = 'force-dynamic';

/** Every published post, plus the home, topics and about pages (SPEC §13 pages). */
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const { url } = site();
  const posts = await allPosts();
  return [
    { url: `${url}/` },
    { url: `${url}/temas` },
    { url: `${url}/sobre` },
    ...posts.map((post) => ({ url: `${url}/${post.slug}`, lastModified: post.updated_at })),
  ];
};

export default sitemap;
