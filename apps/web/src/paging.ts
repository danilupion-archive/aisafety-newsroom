import type { PostSummary } from './api';
import type { Lang } from './i18n';

import { STRINGS } from './strings';
import { isSlug } from './tags';

/**
 * Pages of posts, latest first. A page starts after the last post of the one before: its `published_at` and, for
 * posts that share that instant, its slug, the order the API lists them in. The two parameters have each language's
 * names (`antes` and `tras`, `before` and `after`). In news order (R-WEB-13) the last post's news date leads (`dia`,
 * `day`). Anything else in the query is no cursor at all, so a hand-edited address shows the first page instead of an
 * error.
 */
export interface Cursor {
  before: string;
  beforeSlug: string | undefined;
  /** In news order only. */
  beforeDate?: string;
}

/** A timeline's order: as posted (the default), or by the day each story happened (R-WEB-13). */
export type Order = 'posted' | 'news';

/** The instants the API gives out: UTC, to the millisecond at most. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,3}))?Z$/;

/**
 * A real instant in that shape. Date.parse takes 30 February as 2 March, and the API refuses it; written back, a real
 * instant reads the same.
 */
const isInstant = (value: string): boolean => {
  const match = INSTANT.exec(value);
  const time = Date.parse(value);
  if (!match || Number.isNaN(time)) {
    return false;
  }
  const millis = (match[1] ?? '').padEnd(3, '0');
  return new Date(time).toISOString() === value.replace(/(?:\.\d+)?Z$/, `.${millis}Z`);
};

/** A real calendar day, `YYYY-MM-DD`, as the API takes a news date. */
const isDay = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

type Query = Record<string, string | string[] | undefined>;

/** The order the query asks for, in the page's language's words (`orden=noticia`, `order=news`); as posted otherwise. */
export const readOrder = (lang: Lang, query: Query): Order => {
  const { key, news } = STRINGS[lang].order;
  return query[key] === news ? 'news' : 'posted';
};

/** The query that asks for an order: none for the default. */
const orderQuery = (lang: Lang, order: Order): Record<string, string> => {
  const { key, news } = STRINGS[lang].order;
  return order === 'news' ? { [key]: news } : {};
};

/** A timeline's first page in an order. */
export const orderHref = (lang: Lang, path: string, order: Order): string => {
  const query = new URLSearchParams(orderQuery(lang, order)).toString();
  return query === '' ? path : `${path}?${query}`;
};

export const readCursor = (
  lang: Lang,
  query: Query,
  order: Order = 'posted',
): Cursor | undefined => {
  const names = STRINGS[lang].cursor;
  const before = query[names.before];
  const slug = query[names.slug];
  const day = query[names.day];
  if (typeof before !== 'string' || !isInstant(before)) {
    return undefined;
  }
  const cursor = {
    before,
    beforeSlug: typeof slug === 'string' && isSlug(slug) ? slug : undefined,
  };
  if (order === 'posted') {
    return cursor;
  }
  return typeof day === 'string' && isDay(day) ? { ...cursor, beforeDate: day } : undefined;
};

/** The address of the page after the one that ends with `last`, in the same order. */
export const nextPage = (
  lang: Lang,
  path: string,
  last: PostSummary,
  order: Order = 'posted',
): string => {
  const names = STRINGS[lang].cursor;
  const query = new URLSearchParams({
    ...orderQuery(lang, order),
    [names.before]: last.published_at,
    [names.slug]: last.slug,
    ...(order === 'news' && last.news_date ? { [names.day]: last.news_date } : {}),
  });
  return `${path}?${query.toString()}`;
};
