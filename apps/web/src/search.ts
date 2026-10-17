import type { Lang } from './i18n';

import { paths } from './i18n';
import { STRINGS } from './strings';

/** The longest search the API takes (R-WEB-18). */
export const SEARCH_MAX = 100;
/** Results per page, and the furthest a page may start. */
export const SEARCH_PAGE = 20;
const FURTHEST = 500;

type Query = Record<string, string | string[] | undefined>;

/**
 * A search page's query (R-WEB-18): the words (trimmed, control characters turned into spaces, cut at 100 characters,
 * none when empty) and where the page starts, under the page's language's parameter names (`q` and `desde`, `q` and
 * `from`). A start that isn't a whole number from 0 to 500 is the first page.
 */
export const readSearch = (lang: Lang, query: Query): { q: string | undefined; from: number } => {
  const names = STRINGS[lang].search.params;
  const raw = query[names.query];
  const q =
    typeof raw === 'string'
      ? raw
          // oxlint-disable-next-line no-control-regex -- control characters are what it takes out
          .replace(/[\u0000-\u001f\u007f]/g, ' ')
          .trim()
          .slice(0, SEARCH_MAX)
      : '';
  const start = query[names.from];
  const from = typeof start === 'string' && /^\d{1,3}$/.test(start) ? Number(start) : 0;
  return { q: q === '' ? undefined : q, from: from <= FURTHEST ? from : 0 };
};

/** A search's address, and its page from `from` on. */
export const searchHref = (lang: Lang, q: string, from = 0): string => {
  const names = STRINGS[lang].search.params;
  const query = new URLSearchParams({ [names.query]: q });
  if (from > 0) {
    query.set(names.from, String(from));
  }
  return `${paths.search(lang)}?${query.toString()}`;
};
