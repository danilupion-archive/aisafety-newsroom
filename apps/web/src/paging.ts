import type { PostSummary } from './api';
import type { Lang } from './i18n';

import { STRINGS } from './strings';
import { isSlug } from './tags';

/**
 * Pages of posts, latest first. A page starts after the last post of the one before: its `published_at` and, for
 * posts that share that instant, its slug, the order the API lists them in. The two parameters have each language's
 * names (`antes` and `tras`, `before` and `after`). Anything else in the query is no cursor at all, so a hand-edited
 * address shows the first page instead of an error.
 */
export interface Cursor {
  before: string;
  beforeSlug: string | undefined;
}

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

type Query = Record<string, string | string[] | undefined>;

export const readCursor = (lang: Lang, query: Query): Cursor | undefined => {
  const names = STRINGS[lang].cursor;
  const before = query[names.before];
  const slug = query[names.slug];
  if (typeof before !== 'string' || !isInstant(before)) {
    return undefined;
  }
  return {
    before,
    beforeSlug: typeof slug === 'string' && isSlug(slug) ? slug : undefined,
  };
};

/** The address of the page after the one that ends with `last`. */
export const nextPage = (lang: Lang, path: string, last: PostSummary): string => {
  const names = STRINGS[lang].cursor;
  const query = new URLSearchParams({ [names.before]: last.published_at, [names.slug]: last.slug });
  return `${path}?${query.toString()}`;
};
