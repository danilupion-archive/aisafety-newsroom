import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { sql } from 'kysely';

import { parse } from '../parse.js';
import { translationOf } from '../posts/data.js';
import { postAddress, publicListQuery, publicTagsQuery } from '../posts/schemas.js';

/**
 * The site's reads (R-WEB-6): published posts only, as newsroom_public, which reaches nothing else (SPEC §7). Outside
 * /api, so no token: no gateway routes them, and only the web pods reach them inside the cluster. Without the role's
 * connection they answer 503. Never cached on the way: the site keeps its own copy, for at most 60 s.
 */
export const publicRoutes =
  (db: Database | undefined): FastifyPluginAsync =>
  async (app) => {
    app.addHook('onRequest', async (_request, reply) => {
      void reply.header('cache-control', 'no-store');
      if (!db) {
        return reply.code(503).send({ error: 'Public reads are not configured' });
      }
    });
    if (!db) {
      app.get('/public/*', async () => undefined);
      return;
    }

    /**
     * One language's posts, latest first, without their body: for its home page, a tag's page, the feed and the
     * sitemap. No pages. How many sources each has (the list says so), not the sources themselves.
     */
    app.get('/public/posts', async (request, reply) => {
      const query = parse(publicListQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      let select = db
        .selectFrom('app.published_posts')
        .select(['lang', 'slug', 'type', 'title', 'summary', 'tags', 'published_at', 'updated_at'])
        .select(sql<number>`jsonb_array_length(sources)`.as('source_count'))
        .where('lang', '=', query.lang)
        .where('type', '<>', 'page')
        .orderBy('published_at', 'desc')
        .orderBy('slug')
        .limit(query.limit);
      if (query.tag !== undefined) {
        select = select.where(sql<boolean>`${query.tag} = ANY(tags)`);
      }
      if (query.before !== undefined) {
        // Compared at the millisecond, the precision the cursor came out with.
        const at = sql`date_trunc('milliseconds', published_at)`;
        const before = new Date(query.before);
        select = select.where(
          query.before_slug === undefined
            ? sql<boolean>`${at} < ${before}`
            : sql<boolean>`(${at} < ${before} OR (${at} = ${before} AND slug > ${query.before_slug}))`,
        );
      }
      return select.execute();
    });

    /**
     * One post (or page) with its body and sources, and the other version of its story (R-WEB-10): its original if it's
     * a translation, its translation if not. Shown only when both are published (D11). 410 once either version is
     * unpublished (§13), 404 if it never was public.
     */
    app.get<{ Params: { lang: string; slug: string } }>(
      '/public/posts/:lang/:slug',
      async (request, reply) => {
        const address = parse(postAddress, request.params, reply);
        if (!address) {
          return reply;
        }
        const name = `${address.lang}/${address.slug}`;
        const row = await db
          .selectFrom('app.published_posts')
          .selectAll()
          .where('lang', '=', address.lang)
          .where('slug', '=', address.slug)
          .executeTakeFirst();
        if (row) {
          const { translation_of_lang, translation_of_slug, ...post } = row;
          const original = translationOf({ translation_of_lang, translation_of_slug });
          const story = original ?? address;
          const translations = await db
            .selectFrom('app.published_posts')
            .select(['lang', 'slug', 'title'])
            .where((eb) =>
              eb.or([
                eb.and([eb('lang', '=', story.lang), eb('slug', '=', story.slug)]),
                eb.and([
                  eb('translation_of_lang', '=', story.lang),
                  eb('translation_of_slug', '=', story.slug),
                ]),
              ]),
            )
            .where('lang', '<>', address.lang)
            .orderBy('lang')
            .execute();
          return { ...post, translation_of: original, translations };
        }
        const gone = await db
          .selectFrom('app.unpublished_posts')
          .selectAll()
          .where('lang', '=', address.lang)
          .where('slug', '=', address.slug)
          .executeTakeFirst();
        return gone
          ? reply
              .code(410)
              .send({ error: `Post ${name} was unpublished`, unpublished_at: gone.unpublished_at })
          : reply.code(404).send({ error: `No post ${name}` });
      },
    );

    /** Unpublished posts' addresses, for the site's proxy to answer 410 without asking for each page (AC-7). */
    app.get('/public/unpublished', async () =>
      db
        .selectFrom('app.unpublished_posts')
        .select(['lang', 'slug'])
        .orderBy('lang')
        .orderBy('slug')
        .execute(),
    );

    /** Every tag in one language with its count of published posts, for the tag pages. */
    app.get('/public/tags', async (request, reply) => {
      const query = parse(publicTagsQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      const rows = await sql<{ tag: string; posts: string }>`
        SELECT tag, count(*) AS posts FROM app.published_posts, unnest(tags) AS tag
        WHERE type <> 'page' AND lang = ${query.lang} GROUP BY tag ORDER BY tag
      `.execute(db);
      return rows.rows.map((row) => ({ tag: row.tag, posts: Number(row.posts) }));
    });
  };
