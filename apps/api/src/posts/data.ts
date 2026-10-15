import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { PostBody } from './schemas.js';

/** A post as the posts API returns it: everything, where it came from included. */
export interface Post {
  slug: string;
  type: 'breve' | 'article' | 'page';
  title: string;
  summary: string;
  body_md: string;
  sources: unknown;
  tags: string[];
  published_at: Date;
  content_ref: unknown;
  created_at: Date;
  updated_at: Date;
  unpublished_at: Date | null;
}

/** The site's clock: a post dated without a time is published at midnight there. */
export const SITE_TIME_ZONE = 'Europe/Madrid';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `published_at` as given, or for a date alone, midnight on the site's clock. Read as UTC, a breve dated today and
 * pushed just after midnight in Madrid would stay hidden for two hours (the views show what's published by now()).
 */
const publishedAt = (value: string) =>
  DATE_ONLY.test(value)
    ? sql<Date>`(${value}::date)::timestamp AT TIME ZONE ${SITE_TIME_ZONE}`
    : value;

/**
 * Creates or replaces a post (§13 `PUT /posts/:slug`). Pushing an unpublished post publishes it again. The same push
 * twice gives the same post (R-API-3); `created` says whether it's new.
 */
export const upsertPost = async (
  db: Database,
  slug: string,
  body: PostBody,
): Promise<{ created: boolean; post: Post }> => {
  const values = {
    type: body.type,
    title: body.title,
    summary: body.summary,
    body_md: body.body_md,
    sources: JSON.stringify(body.sources),
    tags: body.tags,
    published_at: publishedAt(body.published_at),
    content_ref: JSON.stringify(body.content_ref),
  };
  const row = await db
    .insertInto('app.posts')
    .values({ slug, ...values })
    .onConflict((conflict) =>
      conflict.column('slug').doUpdateSet({ ...values, unpublished_at: null }),
    )
    .returningAll()
    // A row the insert created has no previous version: xmax is 0.
    .returning(sql<boolean>`(xmax = 0)`.as('created'))
    .executeTakeFirstOrThrow();
  const { created, ...post } = row;
  return { created, post };
};

/**
 * Unpublishes a post (§13 `DELETE /posts/:slug`): its page answers 410 and it leaves the feeds. The row stays, so
 * pushing it again restores it. Undefined if there's no such post.
 */
export const unpublishPost = async (
  db: Database,
  slug: string,
): Promise<{ slug: string; unpublished_at: Date } | undefined> => {
  const row = await db
    .updateTable('app.posts')
    .set({ unpublished_at: sql<Date>`coalesce(unpublished_at, now())` })
    .where('slug', '=', slug)
    .returning(['slug', 'unpublished_at'])
    .executeTakeFirst();
  return row?.unpublished_at ? { slug: row.slug, unpublished_at: row.unpublished_at } : undefined;
};

/** Every post, unpublished ones included, for aisafety-media to reconcile (§13 `GET /posts`, R-WEB-8). */
export const listPosts = (db: Database) =>
  db
    .selectFrom('app.posts')
    .select([
      'slug',
      'type',
      'title',
      'published_at',
      'updated_at',
      'unpublished_at',
      'content_ref',
    ])
    .orderBy('published_at', 'desc')
    .orderBy('slug')
    .execute();
