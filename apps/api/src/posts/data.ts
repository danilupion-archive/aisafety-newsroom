import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { Lang, PostBody } from './schemas.js';

/** Where a post lives on the site: /<lang>/<slug>. */
export interface PostAddress {
  lang: Lang;
  slug: string;
}

/** A post as the posts API returns it: everything, where it came from included. */
export interface Post {
  lang: Lang;
  slug: string;
  type: 'breve' | 'article' | 'page';
  title: string;
  summary: string;
  body_md: string;
  sources: unknown;
  tags: string[];
  published_at: Date;
  /** The day its story happened (R-WEB-13), `YYYY-MM-DD`; null for a page. */
  news_date: string | null;
  translation_of: PostAddress | null;
  content_ref: unknown;
  created_at: Date;
  updated_at: Date;
  unpublished_at: Date | null;
}

/** The two columns that hold a translation's original, as one address or none. */
export const translationOf = (row: {
  translation_of_lang: Lang | null;
  translation_of_slug: string | null;
}): PostAddress | null =>
  row.translation_of_lang !== null && row.translation_of_slug !== null
    ? { lang: row.translation_of_lang, slug: row.translation_of_slug }
    : null;

/**
 * A post's news date as the API gives it out, `YYYY-MM-DD`: pg would read a date as midnight in the server's time zone,
 * which JSON then shifts to another day.
 */
export const newsDate = () => sql<string | null>`to_char(news_date, 'YYYY-MM-DD')`.as('news_date');

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

/** The day a post was posted on the site's clock: a breve's news date when its push gives none (R-WEB-13). */
const postedDay = (value: string) =>
  DATE_ONLY.test(value)
    ? value
    : sql<string>`(${value}::timestamptz AT TIME ZONE ${SITE_TIME_ZONE})::date`;

/**
 * Creates or replaces a post (§13 `PUT /posts/:lang/:slug`). Pushing an unpublished post publishes it again, unless
 * the push says it's unpublished (a rebuild's). The same push twice gives the same post (R-API-3); `created` says
 * whether it's new. A translation's original must have been pushed already, published or not, and the database keeps
 * a story to one original (R-WEB-10). The site shows either version only once both are published (D11).
 */
export const upsertPost = async (
  db: Database,
  { lang, slug }: PostAddress,
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
    news_date: body.type === 'page' ? null : (body.news_date ?? postedDay(body.published_at)),
    translation_of_lang: body.translation_of?.lang ?? null,
    translation_of_slug: body.translation_of?.slug ?? null,
    content_ref: JSON.stringify(body.content_ref),
  };
  const row = await db
    .insertInto('app.posts')
    .values({ lang, slug, ...values, unpublished_at: body.unpublished ? sql<Date>`now()` : null })
    .onConflict((conflict) =>
      conflict.columns(['lang', 'slug']).doUpdateSet({
        ...values,
        // Already unpublished, it keeps when.
        unpublished_at: body.unpublished ? sql<Date>`coalesce(posts.unpublished_at, now())` : null,
      }),
    )
    .returningAll()
    .returning(sql<string | null>`to_char(news_date, 'YYYY-MM-DD')`.as('news_day'))
    // A row the insert created has no previous version: xmax is 0.
    .returning(sql<boolean>`(xmax = 0)`.as('created'))
    .executeTakeFirstOrThrow();
  const {
    created,
    translation_of_lang,
    translation_of_slug,
    news_date: _,
    news_day,
    ...post
  } = row;
  return {
    created,
    post: {
      ...post,
      news_date: news_day,
      translation_of: translationOf({ translation_of_lang, translation_of_slug }),
    },
  };
};

/**
 * Unpublishes a post (§13 `DELETE /posts/:lang/:slug`): its page answers 410 and it leaves the feeds, and its other
 * version with it (D11). The row stays, so pushing it again restores it. Undefined if there's no such post.
 */
export const unpublishPost = async (
  db: Database,
  { lang, slug }: PostAddress,
): Promise<(PostAddress & { unpublished_at: Date }) | undefined> => {
  const row = await db
    .updateTable('app.posts')
    .set({ unpublished_at: sql<Date>`coalesce(unpublished_at, now())` })
    .where('lang', '=', lang)
    .where('slug', '=', slug)
    .returning(['lang', 'slug', 'unpublished_at'])
    .executeTakeFirst();
  return row?.unpublished_at
    ? { lang: row.lang, slug: row.slug, unpublished_at: row.unpublished_at }
    : undefined;
};

/** Every post, unpublished ones included, for aisafety-media to reconcile (§13 `GET /posts`, R-WEB-8). */
export const listPosts = async (db: Database) => {
  const rows = await db
    .selectFrom('app.posts')
    .select([
      'lang',
      'slug',
      'type',
      'title',
      'published_at',
      'updated_at',
      'unpublished_at',
      'translation_of_lang',
      'translation_of_slug',
      'content_ref',
      newsDate(),
    ])
    .orderBy('published_at', 'desc')
    .orderBy('lang')
    .orderBy('slug')
    .execute();
  return rows.map(({ translation_of_lang, translation_of_slug, ...row }) => ({
    ...row,
    translation_of: translationOf({ translation_of_lang, translation_of_slug }),
  }));
};
