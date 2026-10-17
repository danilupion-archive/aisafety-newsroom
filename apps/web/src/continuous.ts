import type { Lang } from './i18n';
import type { Order } from './paging';

import { orderHref } from './paging';
import { STRINGS } from './strings';

/**
 * The continuous timeline (R-WEB-19): the next page comes on its own as the reader nears the end, until 100 posts have
 * come that way; then it waits for the reader's "Cargar más", and after that comes on its own for 100 more.
 */
export const AUTO_PAUSE = 100;
/** The most posts one address renders, when it's opened again with how far the reader got. */
export const MAX_SHOWN = 300;

export const autoLoads = ({
  autoLoaded,
  more,
  loading,
  failed,
}: {
  autoLoaded: number;
  more: boolean;
  loading: boolean;
  failed: boolean;
}): boolean => more && !loading && !failed && autoLoaded < AUTO_PAUSE;

type Query = Record<string, string | string[] | undefined>;

/** How many posts the address says the reader had (`mostrar`, `show`), up to the bound; none if it says nothing usable. */
export const readShown = (lang: Lang, query: Query): number | undefined => {
  const raw = query[STRINGS[lang].shown];
  if (typeof raw !== 'string' || !/^\d{1,5}$/.test(raw)) {
    return undefined;
  }
  const shown = Number(raw);
  return shown > 0 ? Math.min(shown, MAX_SHOWN) : undefined;
};

/** The timeline's address with how far the reader got, in its order, bounded. */
export const shownHref = (lang: Lang, path: string, order: Order, shown: number): string => {
  const base = orderHref(lang, path, order);
  const query = `${STRINGS[lang].shown}=${Math.min(shown, MAX_SHOWN)}`;
  return `${base}${base.includes('?') ? '&' : '?'}${query}`;
};
