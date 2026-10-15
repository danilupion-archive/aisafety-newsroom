import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { sql } from 'kysely';

import { parse } from '../parse.js';
import { publicListQuery, slug } from '../posts/schemas.js';

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

    /** Latest first, without their body: for the home page, a tag's page, the feed and the sitemap. No pages. */
    app.get('/public/posts', async (request, reply) => {
      const query = parse(publicListQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      let select = db
        .selectFrom('app.published_posts')
        .select(['slug', 'type', 'title', 'summary', 'tags', 'published_at', 'updated_at'])
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

    /** One post (or page) with its body and sources; 410 once unpublished (§13), 404 if it never was. */
    app.get<{ Params: { slug: string } }>('/public/posts/:slug', async (request, reply) => {
      const name = parse(slug, request.params.slug, reply);
      if (name === undefined) {
        return reply;
      }
      const post = await db
        .selectFrom('app.published_posts')
        .selectAll()
        .where('slug', '=', name)
        .executeTakeFirst();
      if (post) {
        return post;
      }
      const gone = await db
        .selectFrom('app.unpublished_posts')
        .selectAll()
        .where('slug', '=', name)
        .executeTakeFirst();
      return gone
        ? reply
            .code(410)
            .send({ error: `Post ${name} was unpublished`, unpublished_at: gone.unpublished_at })
        : reply.code(404).send({ error: `No post ${name}` });
    });

    /** The slugs of unpublished posts, for the site's proxy to answer 410 without asking for each page (AC-7). */
    app.get('/public/unpublished', async () => {
      const rows = await db
        .selectFrom('app.unpublished_posts')
        .select('slug')
        .orderBy('slug')
        .execute();
      return rows.map((row) => row.slug);
    });

    /** Every tag with its count of published posts, for the tag pages. */
    app.get('/public/tags', async () => {
      const rows = await sql<{ tag: string; posts: string }>`
        SELECT tag, count(*) AS posts FROM app.published_posts, unnest(tags) AS tag
        WHERE type <> 'page' GROUP BY tag ORDER BY tag
      `.execute(db);
      return rows.rows.map((row) => ({ tag: row.tag, posts: Number(row.posts) }));
    });
  };
