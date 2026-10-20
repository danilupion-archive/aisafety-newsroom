'use server';

import { isEntityId } from '@aisafety-newsroom/domain/entities';

import type { PostSummary } from './api';

import { latestPosts } from './api';
import { MAX_SHOWN } from './continuous';
import { isLang } from './i18n';
import { cursorOf, type Order } from './paging';
import { TAG } from './tags';

/**
 * The continuous timeline's next posts (R-WEB-19): what comes after the last one the reader has, in the timeline's
 * order, for the home page, a tag's or an entity's. A server action, so anyone can call it: every value is checked as an
 * address's query would be, and a page is at most what one address may render. Anything else answers nothing.
 */
export const morePosts = async (input: {
  lang: unknown;
  order: unknown;
  tag?: unknown;
  entity?: unknown;
  after: unknown;
  limit: unknown;
}): Promise<PostSummary[]> => {
  const { lang, order, tag, entity, after, limit } = input;
  if (!isLang(lang) || (order !== 'posted' && order !== 'news')) {
    return [];
  }
  const cursor = cursorOf(after, order as Order);
  const count = typeof limit === 'number' && Number.isInteger(limit) ? limit : 0;
  const tagged =
    tag === undefined ? undefined : typeof tag === 'string' && TAG.test(tag) ? tag : null;
  const naming = entity === undefined ? undefined : isEntityId(entity) ? entity : null;
  // One more than an address may render: the timeline asks for one extra to know whether any are left.
  if (!cursor || count < 1 || count > MAX_SHOWN + 1 || tagged === null || naming === null) {
    return [];
  }
  return latestPosts(lang, { after: cursor, limit: count, order, tag: tagged, entity: naming });
};
