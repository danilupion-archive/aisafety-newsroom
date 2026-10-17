/**
 * The public site's languages (R-WEB-4, D10): Spanish and English on one host, Spanish at the root (`/…`) and English
 * under its prefix (`/en/…`), each with its own words for the site's pages. The API and the site share this one list.
 */
export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (LANGS as readonly string[]).includes(value);

/** Each language's words for the site's own pages: `/etiqueta/<tag>`, `/en/topics`, `/sobre`. */
export const PATH_WORDS = {
  es: { tag: 'etiqueta', topics: 'temas', about: 'sobre' },
  en: { tag: 'tag', topics: 'topics', about: 'about' },
} as const satisfies Record<Lang, { tag: string; topics: string; about: string }>;

/**
 * What else shares the root with Spanish posts: the languages' prefixes (`/en` is English's home, `/es` redirects to
 * `/`), the health check, and the folders of the site's images and share cards (`/img/…`, `/og/…`, D17). The site's
 * other root files have a dot in their names, which no slug has.
 */
const ROOT_WORDS = [...LANGS, 'healthz', 'img', 'og'];

/**
 * Every word either language uses for the site's pages, and the root's own words. The site routes each page word in
 * both languages (a page in the wrong language answers 404), so no post may take one as its slug, in either; the about
 * page alone takes its own language's word.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...LANGS.flatMap((lang) => Object.values(PATH_WORDS[lang])),
  ...ROOT_WORDS,
]);
