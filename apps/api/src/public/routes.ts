import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { type RawBuilder, sql } from 'kysely';
import { z } from 'zod';

import { NO_STORE } from '../images/routes.js';
import { type ImageStore, SHA256 } from '../images/store.js';
import { parse } from '../parse.js';
import { newsDate, translationOf } from '../posts/data.js';
import {
  type Lang,
  postAddress,
  publicEntitiesQuery,
  publicEntityAddress,
  publicListQuery,
  publicSearchQuery,
  publicTagsQuery,
} from '../posts/schemas.js';
import { MARK_END, MARK_START, segments } from './excerpt.js';

/** A YouTube video's address, in any of its forms (the domain's youtubeVideoId reads them for the site). */
const YOUTUBE_ADDRESS =
  '^https?://([a-z0-9-]+\\.)?(youtube\\.com|youtu\\.be|youtube-nocookie\\.com)/';

/** Each language's full-text search rules (R-WEB-18). */
const SEARCH_CONFIG = { es: 'spanish', en: 'english' } as const;
/** The accented vowels a reader often types without their accents, and what they become. */
const FOLD_FROM = 'ÁÉÍÓÚÜáéíóúü';
const FOLD_TO = 'AEIOUUaeiouu';
/** A short excerpt around the best match, its words between the two marks (src/public/excerpt.ts). */
const HEADLINE = `StartSel=${MARK_START}, StopSel=${MARK_END}, MaxWords=32, MinWords=14, ShortWord=0, MaxFragments=2, FragmentDelimiter=" … "`;

/**
 * The site's reads (R-WEB-6): published posts only, as newsroom_public, which reaches nothing else (SPEC §7). Outside
 * /api, so no token: no gateway routes them, and only the web pods reach them inside the cluster. Without the role's
 * connection they answer 503. Never cached on the way: the site keeps its own copy, for at most 60 s.
 */
/** An image file the site may serve: a post's lead image or a source's preview, in either size (R-WEB-15, R-WEB-16). */
const imageAddress = z.strictObject({
  kind: z.enum(['lead', 'preview']),
  sha256: z.string().regex(SHA256, 'an image is named by its SHA-256, in lowercase hex'),
});
const imageQuery = z.object({ size: z.enum(['full', 'thumb']).default('full') });

export const publicRoutes =
  (db: Database | undefined, store?: ImageStore): FastifyPluginAsync =>
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
     * A published post as the lists show it, without its body: for a timeline's card, a feed's entry, a search result.
     * Callers add the language, leave pages out, and choose the order.
     */
    const summaries = () =>
      db
        .selectFrom('app.published_posts')
        .select([
          'lang',
          'slug',
          'type',
          'title',
          'summary',
          'tags',
          'published_at',
          'updated_at',
          // For the card's thumbnail, already held to the switches by the view (R-CAP-10).
          'image',
          // Who wrote it when a person did, and a translation's original writer (R-WEB-3, D19).
          'author',
          'original_author',
          // Who and what it's about, in its language, without those the bot hid (R-WEB-20, R-CAP-12).
          'entities',
        ])
        .select(newsDate())
        .select(sql<number>`jsonb_array_length(sources)`.as('source_count'))
        // A source preview the view still shows, for a card without a lead image (R-WEB-16, R-CAP-10), with its
        // source's address: a YouTube video's first, whose still becomes the card's player (R-WEB-12), else the first.
        .select(
          sql<{ sha256: string; credit: string; source_url: string } | null>`(
            select (source.value -> 'preview') || jsonb_build_object('source_url', source.value -> 'url')
            from jsonb_array_elements(sources) with ordinality as source(value, position)
            where source.value ? 'preview'
            order by (source.value ->> 'url') ~* ${YOUTUBE_ADDRESS} desc, source.position
            limit 1
          )`.as('preview'),
        );

    /**
     * One language's posts, latest first, without their body: for its home page, a tag's or an entity's page, the feed
     * and the sitemap. No pages. How many sources each has (the list says so), not the sources themselves. In news
     * order, by the day each story happened, newest first, then as posted (R-WEB-13).
     */
    app.get('/public/posts', async (request, reply) => {
      const query = parse(publicListQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      let select = summaries()
        .where('lang', '=', query.lang)
        .where('type', '<>', 'page')
        .limit(query.limit);
      if (query.order === 'news') {
        select = select.orderBy('news_date', 'desc');
      }
      select = select.orderBy('published_at', 'desc').orderBy('slug');
      if (query.tag !== undefined) {
        select = select.where(sql<boolean>`${query.tag} = ANY(tags)`);
      }
      if (query.entity !== undefined) {
        // As the view gives them out: an entity the bot hid names no post (R-CAP-12).
        select = select.where(
          sql<boolean>`entities @> ${JSON.stringify([{ id: query.entity }])}::jsonb`,
        );
      }
      if (query.before !== undefined || query.before_date !== undefined) {
        // Compared at the millisecond, the precision the cursor came out with.
        const at = sql`date_trunc('milliseconds', published_at)`;
        const before = query.before === undefined ? undefined : new Date(query.before);
        const posted =
          before === undefined
            ? undefined
            : query.before_slug === undefined
              ? sql<boolean>`${at} < ${before}`
              : sql<boolean>`(${at} < ${before} OR (${at} = ${before} AND slug > ${query.before_slug}))`;
        const day = query.before_date;
        select = select.where(
          day === undefined
            ? (posted ?? sql<boolean>`true`)
            : posted === undefined
              ? sql<boolean>`news_date < ${day}::date`
              : sql<boolean>`(news_date < ${day}::date OR (news_date = ${day}::date AND ${posted}))`,
        );
      }
      return select.execute();
    });

    /**
     * A reader's search in one language (R-WEB-18): Postgres's full-text search in that language's rules, over what the
     * site shows (published breves and articles, never pages), the title weighing most, then the summary, then the
     * text. Each field is indexed twice, as written and with its accents taken off, so a word typed without them still
     * finds it. Searched on the fly, with no index: a few hundred posts take milliseconds. Each result carries an
     * excerpt of its summary and text with the matched words marked, as plain-text segments (src/public/excerpt.ts).
     */
    app.get('/public/search', async (request, reply) => {
      const query = parse(publicSearchQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      const config = sql`${SEARCH_CONFIG[query.lang]}::regconfig`;
      // The text as a reader reads it: no link targets, tags or Markdown marks.
      const plain = sql`regexp_replace(regexp_replace(regexp_replace(body_md, ${'\\]\\([^)]*\\)'}, ']', 'g'), ${'<[^>]*>'}, ' ', 'g'), ${'[\\[\\]*_#>`~]+'}, '', 'g')`;
      const indexed = (text: RawBuilder<unknown>, weight: 'A' | 'B' | 'C') =>
        sql`setweight(to_tsvector(${config}, ${text}) || to_tsvector(${config}, translate(${text}, ${FOLD_FROM}, ${FOLD_TO})), ${sql.lit(weight)})`;
      const document = sql`(${indexed(sql`title`, 'A')} || ${indexed(sql`summary`, 'B')} || ${indexed(plain, 'C')})`;
      const words = sql`websearch_to_tsquery(${config}, ${query.q})`;
      const rows = await summaries()
        .select(
          sql<string>`ts_headline(${config}, summary || ' … ' || ${plain}, ${words}, ${HEADLINE})`.as(
            'excerpt',
          ),
        )
        .where('lang', '=', query.lang)
        .where('type', '<>', 'page')
        .where(sql<boolean>`${document} @@ ${words}`)
        .orderBy(sql`ts_rank(${document}, ${words})`, 'desc')
        .orderBy('published_at', 'desc')
        .orderBy('slug')
        .offset(query.cursor)
        .limit(query.limit + 1)
        .execute();
      const page = rows.slice(0, query.limit);
      return {
        results: page.map((row) => ({ ...row, excerpt: segments(row.excerpt) })),
        next: rows.length > query.limit ? query.cursor + query.limit : null,
      };
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
          .select(newsDate())
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

    /**
     * An image's WebP, full or thumbnail, while a published post shows it as that kind and the switches allow it: the
     * view decides on every request, so a switch or a removal takes effect at once (R-CAP-10, R-CAP-11). 404 for
     * anything else, an upload no published post names included.
     */
    app.get<{ Params: { kind: string; sha256: string } }>(
      '/public/images/:kind/:sha256',
      async (request, reply) => {
        const address = parse(imageAddress, request.params, reply);
        const query = address && parse(imageQuery, request.query, reply);
        if (!address || !query) {
          return reply;
        }
        if (!store) {
          return reply.code(503).send(NO_STORE);
        }
        // The database decides whether the image may be shown (R-CAP-10, R-CAP-11); the bytes are only on the volume
        // (D22).
        const shown = await db
          .selectFrom('app.public_images')
          .select('sha256')
          .where('sha256', '=', address.sha256)
          .where('kind', '=', address.kind)
          .limit(1)
          .executeTakeFirst();
        if (!shown) {
          return reply.code(404).send({ error: 'No such image' });
        }
        const bytes = await store.read(address.sha256, query.size);
        if (!bytes) {
          // Shown by the database, gone from the volume: the census lists it, and the same upload writes it back.
          request.log.error(
            { sha256: address.sha256, size: query.size },
            'an image file is missing',
          );
          return reply.code(404).send({ error: 'No such image' });
        }
        return reply.type('image/webp').send(bytes);
      },
    );

    /**
     * Every entity a published story in one language names (R-WEB-20), its name and description in that language, with
     * how many stories name it: for the index and the sitemap. One the bot hid isn't there (R-CAP-12).
     */
    const entities = (lang: Lang) =>
      db
        .selectFrom('app.public_entities')
        .select(['id', 'type', 'name', 'description', 'wikidata', 'posts'])
        .where('lang', '=', lang);

    app.get('/public/entities', async (request, reply) => {
      const query = parse(publicEntitiesQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      return entities(query.lang).orderBy('id').execute();
    });

    /** One of them, for its page; 404 for any other, so the page answers 404 too, like a tag no story carries. */
    app.get<{ Params: { id: string } }>('/public/entities/:id', async (request, reply) => {
      const address = parse(publicEntityAddress, request.params, reply);
      const query = address && parse(publicEntitiesQuery, request.query, reply);
      if (!address || !query) {
        return reply;
      }
      const entity = await entities(query.lang).where('id', '=', address.id).executeTakeFirst();
      return entity ?? reply.code(404).send({ error: `No entity ${address.id}` });
    });

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
