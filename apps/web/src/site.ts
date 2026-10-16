import type { Lang } from './i18n';

/**
 * The site's configuration, read when a page renders (never at build time, so the image works for any deployment).
 * Names and addresses come from configuration, never from code (R-WEB-9).
 */
export interface Site {
  /** The site's public address, without a trailing slash, for canonical links, the feeds and the sitemap. */
  url: string;
  /** Its name in each language: the header, page titles and feeds. */
  name: Record<Lang, string>;
  /** Who writes it (R-WEB-3). */
  author: string;
  /** The API's public read routes, inside the cluster (R-WEB-6). */
  apiUrl: string;
  /** Plausible's script and this site's domain in it (R-WEB-7); both or neither. */
  analytics: { scriptUrl: string; domain: string } | undefined;
}

type Env = Record<string, string | undefined>;

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const readSite = (env: Env): Site => {
  const scriptUrl = env.PLAUSIBLE_SCRIPT_URL;
  const domain = env.PLAUSIBLE_DOMAIN;
  return {
    url: trimSlash(env.SITE_URL ?? 'http://localhost:3000'),
    name: {
      es: env.SITE_NAME_ES ?? 'Sitio de ejemplo',
      en: env.SITE_NAME_EN ?? 'Example site',
    },
    author: env.AUTHOR_NAME ?? 'Autor de ejemplo',
    apiUrl: trimSlash(env.API_URL ?? 'http://127.0.0.1:3001'),
    analytics: scriptUrl && domain ? { scriptUrl, domain } : undefined,
  };
};

export const site = (): Site => readSite(process.env);
