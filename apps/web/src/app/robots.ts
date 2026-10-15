import type { MetadataRoute } from 'next';

import { site } from '@/site';

export const dynamic = 'force-dynamic';

const robots = (): MetadataRoute.Robots => ({
  rules: { userAgent: '*', allow: '/' },
  sitemap: `${site().url}/sitemap.xml`,
});

export default robots;
