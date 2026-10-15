import type { PostSummary } from './api';

/**
 * Pages of posts, latest first. A page starts after the last post of the one before: its `published_at` (`antes`) and,
 * for posts that share that instant, its slug (`tras`), the order the API lists them in. Anything else in the query is
 * no cursor at all, so a hand-edited address shows the first page instead of an error.
 */
export interface Cursor {
  before: string;
  beforeSlug: string | undefined;
}

/** The instants the API gives out: UTC, to the millisecond at most. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Param = string | string[] | undefined;

export const readCursor = (antes: Param, tras: Param): Cursor | undefined => {
  if (typeof antes !== 'string' || !INSTANT.test(antes) || Number.isNaN(Date.parse(antes))) {
    return undefined;
  }
  return {
    before: antes,
    beforeSlug: typeof tras === 'string' && SLUG.test(tras) ? tras : undefined,
  };
};

/** The address of the page after the one that ends with `last`. */
export const nextPage = (path: string, last: PostSummary): string =>
  `${path}?${new URLSearchParams({ antes: last.published_at, tras: last.slug }).toString()}`;
