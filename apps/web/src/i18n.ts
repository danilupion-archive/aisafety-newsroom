import { isLang, type Lang, PATH_WORDS } from '@aisafety-newsroom/domain/languages';

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
