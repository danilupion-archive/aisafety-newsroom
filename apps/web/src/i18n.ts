import { isLang, type Lang, PATH_WORDS } from '@aisafety-newsroom/domain/languages';

import { TAG } from './tags';

/**
 * The site's languages (R-WEB-4, D10), shared with the API: Spanish and English on one host, each under its own
 * prefix, with its own words for the site's paths. Spanish is the default: the main readers are in Spain.
 */
export { isLang, LANGS, PATH_WORDS } from '@aisafety-newsroom/domain/languages';
export type { Lang };

export const DEFAULT_LANG: Lang = 'es';

export const otherLang = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es');

/** Every address the site links to, built in one place. */
export const paths = {
  home: (lang: Lang) => `/${lang}`,
  post: (lang: Lang, slug: string) => `/${lang}/${slug}`,
  tag: (lang: Lang, tag: string) => `/${lang}/${PATH_WORDS[lang].tag}/${tag}`,
  topics: (lang: Lang) => `/${lang}/${PATH_WORDS[lang].topics}`,
  about: (lang: Lang) => `/${lang}/${PATH_WORDS[lang].about}`,
  feed: (lang: Lang) => `/${lang}/feed.xml`,
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
  const [, first, second, third, ...rest] = (pathname ?? '').split('/');
  const words = PATH_WORDS[lang];
  if (first !== lang || rest.length > 0 || !second) {
    return paths.home(other);
  }
  if (third !== undefined) {
    return second === words.tag && TAG.test(third) ? paths.tag(other, third) : paths.home(other);
  }
  if (second === words.topics) {
    return paths.topics(other);
  }
  if (second === words.about) {
    return paths.about(other);
  }
  return translation?.lang === other ? paths.post(other, translation.slug) : paths.home(other);
};

/** A language tag's weight in an Accept-Language entry: `q=0.8`, 1 without one, 0 if it isn't a number. */
const weight = (params: readonly string[]): number => {
  const q = params.find((param) => param.trim().startsWith('q='));
  if (q === undefined) {
    return 1;
  }
  const value = Number(q.trim().slice(2));
  return Number.isFinite(value) ? value : 0;
};

/**
 * The reader's language for `/`: the first of the site's languages their browser asks for, by weight (`es-ES`
 * counts as `es`); Spanish when it asks for neither, or sends nothing.
 */
export const preferredLang = (header: string | null | undefined): Lang => {
  const wanted = (header ?? '')
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.split(';');
      return { lang: tag.trim().toLowerCase().split('-')[0], q: weight(params), index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return wanted.map((entry) => entry.lang).find(isLang) ?? DEFAULT_LANG;
};
