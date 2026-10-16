import { isLang, type Lang, PATH_WORDS } from '@aisafety-newsroom/domain/languages';

import { isSlug, TAG } from './tags';

/**
 * The site's languages (R-WEB-4, D10), shared with the API: Spanish and English on one host, each with its own words
 * for the site's paths. Spanish is at the root, since the main readers are in Spain; English is under `/en`.
 */
export { isLang, LANGS, PATH_WORDS } from '@aisafety-newsroom/domain/languages';
export type { Lang };

/** The language at the root. Its pages are `app/[lang]`'s like English's: the proxy serves them from `/es/…`. */
export const DEFAULT_LANG: Lang = 'es';

export const otherLang = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es');

/** What a language's addresses start with: nothing for Spanish, `/en` for English. */
const prefix = (lang: Lang): string => (lang === DEFAULT_LANG ? '' : `/${lang}`);

/** Every address the site links to, built in one place. */
export const paths = {
  home: (lang: Lang) => prefix(lang) || '/',
  post: (lang: Lang, slug: string) => `${prefix(lang)}/${slug}`,
  tag: (lang: Lang, tag: string) => `${prefix(lang)}/${PATH_WORDS[lang].tag}/${tag}`,
  topics: (lang: Lang) => `${prefix(lang)}/${PATH_WORDS[lang].topics}`,
  about: (lang: Lang) => `${prefix(lang)}/${PATH_WORDS[lang].about}`,
  feed: (lang: Lang) => `${prefix(lang)}/feed.xml`,
};

/**
 * A public address's language and the rest of its path: English under `/en`, Spanish anything else. Undefined for
 * `/es…`, which is no public address: a reader's request for one goes to the same address without the prefix.
 */
export const readPath = (
  pathname: string | undefined,
): { lang: Lang; segments: string[] } | undefined => {
  const path = (pathname ?? '').split('/').slice(1);
  // A trailing slash adds no segment: `/en/` is `/en`.
  const [first = '', ...rest] = path.at(-1) === '' ? path.slice(0, -1) : path;
  if (first === DEFAULT_LANG) {
    return undefined;
  }
  if (isLang(first)) {
    return { lang: first, segments: rest };
  }
  return { lang: DEFAULT_LANG, segments: first === '' ? [] : [first, ...rest] };
};

/** The site's own files outside the languages, served as they are. */
const ROOT_FILES = new Set([
  '/healthz',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
  '/icon.svg',
]);

/**
 * How the proxy serves an address (D10, AC-11): the site's own files as they are; a page in its language, the Spanish
 * ones from `app/[lang]` under `/es`. A page's `post` is the post its address would be (the about page is one too), for
 * the 410 of an unpublished one. `/es…` is internal: Next may run the proxy again on the address it rewrote a Spanish
 * page to, and a reader's request for one never reaches it (next.config.js redirects it to the address without the
 * prefix).
 */
export type Route =
  | { kind: 'file' }
  | { kind: 'internal' }
  | { kind: 'page'; internal: string; post: { lang: Lang; slug: string } | undefined };

export const route = (pathname: string): Route => {
  if (ROOT_FILES.has(pathname) || pathname.startsWith('/_next/')) {
    return { kind: 'file' };
  }
  const path = readPath(pathname);
  if (!path) {
    return { kind: 'internal' };
  }
  const [slug, ...rest] = path.segments;
  const post =
    slug !== undefined && rest.length === 0 && isSlug(slug) ? { lang: path.lang, slug } : undefined;
  return {
    kind: 'page',
    internal:
      path.lang === DEFAULT_LANG ? `/${DEFAULT_LANG}${pathname === '/' ? '' : pathname}` : pathname,
    post,
  };
};

/** The request header the proxy passes a page's path in: a layout isn't told it, and the header's switch needs it. */
export const PATHNAME_HEADER = 'x-site-pathname';

/**
 * The same page in the other language, for the header's switch: the home, the topics, the about page and a tag's page
 * in that language's words; a post's translation when it has one. That language's home for anything else, a post with
 * no translation included.
 */
export const otherLanguageHref = (
  lang: Lang,
  pathname: string | undefined,
  translation?: { lang: Lang; slug: string },
): string => {
  const other = otherLang(lang);
  const path = readPath(pathname);
  if (!path || path.lang !== lang || path.segments.length === 0 || path.segments.length > 2) {
    return paths.home(other);
  }
  const [first = '', second] = path.segments;
  const words = PATH_WORDS[lang];
  if (second !== undefined) {
    return first === words.tag && TAG.test(second) ? paths.tag(other, second) : paths.home(other);
  }
  if (first === words.topics) {
    return paths.topics(other);
  }
  if (first === words.about) {
    return paths.about(other);
  }
  return translation?.lang === other ? paths.post(other, translation.slug) : paths.home(other);
};
