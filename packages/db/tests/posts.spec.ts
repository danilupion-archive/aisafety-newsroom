import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';
import { superuserUrl } from './env.js';

const INSERT_POST = `INSERT INTO app.posts
    (slug, lang, translation_of_lang, translation_of_slug, type, title, body_md, published_at, content_ref, unpublished_at,
     news_date)
  VALUES ($1, $2, $3, $4, $7, 'Un título de ejemplo', 'Texto de ejemplo.', $5, '{"path": "posts/x.md"}', $6, $8)`;

/** A breve or article is dated by its story (R-WEB-13), 30 September unless given; `news_date: ''` leaves it out. */
const postValues = (slug: string, extra: Record<string, string> = {}) => [
  slug,
  extra.lang ?? 'es',
  extra.translation_of?.split('/')[0] ?? null,
  extra.translation_of?.split('/')[1] ?? null,
  extra.published_at ?? '2026-10-01',
  extra.unpublished_at ?? null,
  extra.type ?? 'breve',
  extra.news_date === ''
    ? null
    : (extra.news_date ?? (extra.type === 'page' ? null : '2026-09-30')),
];

const insertPost = (client: pg.Client, slug: string, extra: Record<string, string> = {}) =>
  client.query(INSERT_POST, postValues(slug, extra));

describe('app.posts', () => {
  it('takes only slugs made of lowercase words and hyphens', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      for (const slug of ['Con-Mayusculas', 'con espacio', 'acentuó', '-guion', 'doble--guion']) {
        expect(
          await failure(
            client,
            `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, news_date)
             VALUES ($1, 'es', 'breve', 't', 'b', now(), '{}', '2026-09-30')`,
            [slug],
          ),
        ).toEqual({ code: '23514', constraint: 'posts_slug_format' });
      }
    });
  });

  it('names who wrote a post when a person did, and for a translation its original’s writer (R-WEB-3, D19)', async () => {
    const shown = await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'escrita-a-mano');
      await insertPost(client, 'written-by-hand', {
        lang: 'en',
        translation_of: 'es/escrita-a-mano',
      });
      await client.query(
        `UPDATE app.posts SET author = 'Autora de Ejemplo' WHERE slug = 'escrita-a-mano'`,
      );
      for (const author of ['', ' Con espacios ', 'x'.repeat(101)]) {
        expect(
          await failure(client, `UPDATE app.posts SET author = $1 WHERE slug = 'escrita-a-mano'`, [
            author,
          ]),
        ).toEqual({ code: '23514', constraint: 'posts_author_format' });
      }
      await client.query('SET LOCAL ROLE newsroom_public');
      const { rows } = await client.query<{
        slug: string;
        author: string | null;
        original_author: string | null;
      }>('SELECT slug, author, original_author FROM app.published_posts ORDER BY lang');
      return rows;
    });
    expect(shown).toEqual([
      { slug: 'escrita-a-mano', author: 'Autora de Ejemplo', original_author: null },
      { slug: 'written-by-hand', author: null, original_author: 'Autora de Ejemplo' },
    ]);
  });

  it('shows newsroom_public published posts only, and never where they came from', async () => {
    const visible = await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'publicada');
      await insertPost(client, 'published', { lang: 'en', translation_of: 'es/publicada' });
      await insertPost(client, 'programada', { published_at: '2999-01-01' });
      await insertPost(client, 'scheduled', {
        lang: 'en',
        translation_of: 'es/programada',
        published_at: '2999-01-01',
      });
      await insertPost(client, 'retirada', { unpublished_at: '2026-10-10' });
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query<Record<string, unknown>>(
        'SELECT * FROM app.published_posts ORDER BY lang',
      );
      const unpublished = await client.query<{ slug: string }>(
        'SELECT slug FROM app.unpublished_posts',
      );
      expect(await failure(client, 'SELECT FROM app.posts')).toEqual({ code: '42501' });
      return { published: published.rows, unpublished: unpublished.rows.map((row) => row.slug) };
    });
    expect(visible.published.map((post) => post.slug)).toEqual(['publicada', 'published']);
    expect(visible.published[0]).not.toHaveProperty('content_ref');
    expect(visible.published[0]).not.toHaveProperty('unpublished_at');
    expect(visible.unpublished).toEqual(['retirada']);
  });

  it('shows a story only in both languages: a post shows when it and its other version are published (D11)', async () => {
    const visible = await inRolledBackTransaction(async (client) => {
      // Alone: never public, so neither shown nor gone.
      await insertPost(client, 'sola');
      // Both published, the translation first or the original first, posts and pages alike.
      await insertPost(client, 'pareja');
      await insertPost(client, 'pair', { lang: 'en', translation_of: 'es/pareja' });
      await insertPost(client, 'first', { lang: 'en' });
      await insertPost(client, 'primero', { translation_of: 'en/first' });
      await insertPost(client, 'sobre', { type: 'page' });
      await insertPost(client, 'about', { lang: 'en', type: 'page', translation_of: 'es/sobre' });
      // The translation dated later: neither shows until it is published.
      await insertPost(client, 'pronto');
      await insertPost(client, 'soon', {
        lang: 'en',
        translation_of: 'es/pronto',
        published_at: '2999-01-01',
      });
      // One version unpublished, the original or the translation: both are gone.
      await insertPost(client, 'retirado', { unpublished_at: '2026-10-10T12:00:00Z' });
      await insertPost(client, 'withdrawn', { lang: 'en', translation_of: 'es/retirado' });
      await insertPost(client, 'traducida');
      await insertPost(client, 'translated', {
        lang: 'en',
        translation_of: 'es/traducida',
        unpublished_at: '2026-10-11T12:00:00Z',
      });
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query<{ address: string }>(
        `SELECT lang || '/' || slug AS address FROM app.published_posts ORDER BY address`,
      );
      const unpublished = await client.query<{ address: string; unpublished_at: Date }>(
        `SELECT lang || '/' || slug AS address, unpublished_at FROM app.unpublished_posts ORDER BY address`,
      );
      return { published: published.rows, unpublished: unpublished.rows };
    });
    expect(visible.published.map((row) => row.address)).toEqual([
      'en/about',
      'en/first',
      'en/pair',
      'es/pareja',
      'es/primero',
      'es/sobre',
    ]);
    // Each gone version says when the story went: its own date, or else its other version's.
    expect(
      visible.unpublished.map((row) => [
        row.address,
        row.unpublished_at.toISOString().slice(0, 10),
      ]),
    ).toEqual([
      ['en/translated', '2026-10-11'],
      ['en/withdrawn', '2026-10-10'],
      ['es/retirado', '2026-10-10'],
      ['es/traducida', '2026-10-11'],
    ]);
  });

  it('never dates a page by a story (R-WEB-13)', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      expect(
        await failure(
          client,
          INSERT_POST,
          postValues('sobre', { type: 'page', news_date: '2026-09-30' }),
        ),
      ).toEqual({ code: '23514', constraint: 'posts_page_has_no_news_date' });
    });
  });

  it('shows a story only while both versions carry the same news date (R-WEB-13)', async () => {
    const visible = await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'pareja', { news_date: '2026-09-28' });
      await insertPost(client, 'pair', {
        lang: 'en',
        translation_of: 'es/pareja',
        news_date: '2026-09-28',
      });
      // A date corrected in one version and not yet in the other: neither shows, and neither is gone.
      await insertPost(client, 'desfase', { news_date: '2026-09-28' });
      await insertPost(client, 'mismatch', {
        lang: 'en',
        translation_of: 'es/desfase',
        news_date: '2026-09-27',
      });
      await insertPost(client, 'sobre', { type: 'page' });
      await insertPost(client, 'about', { lang: 'en', type: 'page', translation_of: 'es/sobre' });
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query<{ address: string; news_date: string | null }>(
        `SELECT lang || '/' || slug AS address, to_char(news_date, 'YYYY-MM-DD') AS news_date
         FROM app.published_posts ORDER BY address`,
      );
      const gone = await client.query('SELECT slug FROM app.unpublished_posts');
      return { published: published.rows, gone: gone.rows };
    });
    expect(visible.published).toEqual([
      { address: 'en/about', news_date: null },
      { address: 'en/pair', news_date: '2026-09-28' },
      { address: 'es/pareja', news_date: '2026-09-28' },
      { address: 'es/sobre', news_date: null },
    ]);
    expect(visible.gone).toEqual([]);
  });

  it('lists a breve without a news date (pushed before them) by its posted day, and lets it go as before', async () => {
    const rows = await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      await insertPost(client, 'antigua', { news_date: '', published_at: '2026-10-01T22:30:00Z' });
      await insertPost(client, 'old', {
        lang: 'en',
        translation_of: 'es/antigua',
        news_date: '',
        published_at: '2026-10-01T22:30:00Z',
      });
      // One version pushed again with its day, the other not yet: the same day, so the story still shows.
      await insertPost(client, 'reciente', { news_date: '', published_at: '2026-10-05T08:00:00Z' });
      await insertPost(client, 'recent', {
        lang: 'en',
        translation_of: 'es/reciente',
        news_date: '2026-10-05',
        published_at: '2026-10-05T08:00:00Z',
      });
      await client.query('SET LOCAL ROLE newsroom_public');
      const { rows } = await client.query<{ address: string; news_date: string }>(
        `SELECT lang || '/' || slug AS address, to_char(news_date, 'YYYY-MM-DD') AS news_date
         FROM app.published_posts ORDER BY address`,
      );
      await client.query('RESET ROLE');
      await client.query('SET LOCAL ROLE newsroom_app');
      // Unpublishing it is an update like any other: nothing about its missing date refuses it.
      expect(
        await failure(client, `UPDATE app.posts SET unpublished_at = now() WHERE slug = 'antigua'`),
      ).toBeNull();
      return rows;
    });
    // 22:30 UTC on 1 October is 2 October in Madrid.
    expect(rows).toEqual([
      { address: 'en/old', news_date: '2026-10-02' },
      { address: 'en/recent', news_date: '2026-10-05' },
      { address: 'es/antigua', news_date: '2026-10-02' },
      { address: 'es/reciente', news_date: '2026-10-05' },
    ]);
  });

  it('takes one slug once per language: a story has an address in each (R-WEB-10)', async () => {
    await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'mismo-nombre');
      await insertPost(client, 'mismo-nombre', { lang: 'en' });
      expect(await failure(client, INSERT_POST, postValues('mismo-nombre'))).toEqual({
        code: '23505',
        constraint: 'posts_pkey',
      });
    });
  });

  it('links a translation to a post in the other language that has been pushed already', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      await insertPost(client, 'informe');
      await insertPost(client, 'report', { lang: 'en', translation_of: 'es/informe' });
      expect(
        await failure(client, INSERT_POST, postValues('otro', { translation_of: 'es/informe' })),
      ).toEqual({ code: '23514', constraint: 'posts_translation_other_lang' });
      expect(
        await failure(
          client,
          INSERT_POST,
          postValues('x', { lang: 'en', translation_of: 'es/no-existe' }),
        ),
      ).toEqual({ code: '23503', constraint: 'posts_translation_of_fkey' });
      // One translation per language.
      expect(
        await failure(
          client,
          INSERT_POST,
          postValues('report-2', { lang: 'en', translation_of: 'es/informe' }),
        ),
      ).toEqual({ code: '23505', constraint: 'posts_one_translation_per_lang' });
    });
  });

  it('keeps a story to one original: a translation is never translated, an original never becomes one', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      await insertPost(client, 'informe');
      await insertPost(client, 'report', { lang: 'en', translation_of: 'es/informe' });
      expect(
        await failure(
          client,
          INSERT_POST,
          postValues('informe-2', { translation_of: 'en/report' }),
        ),
      ).toEqual({ code: '23514', constraint: 'posts_translation_of_original' });

      await insertPost(client, 'other-report', { lang: 'en' });
      expect(
        await failure(
          client,
          `UPDATE app.posts SET translation_of_lang = 'en', translation_of_slug = 'other-report'
           WHERE lang = 'es' AND slug = 'informe'`,
        ),
      ).toEqual({ code: '23514', constraint: 'posts_translated_is_original' });
    });
  });

  it('shows newsroom_public each post’s language and what it translates', async () => {
    const rows = await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'informe');
      await insertPost(client, 'report', { lang: 'en', translation_of: 'es/informe' });
      await insertPost(client, 'retirado', { lang: 'en', unpublished_at: '2026-10-10' });
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query(
        'SELECT lang, slug, translation_of_lang, translation_of_slug FROM app.published_posts ORDER BY lang',
      );
      const unpublished = await client.query('SELECT lang, slug FROM app.unpublished_posts');
      return { published: published.rows, unpublished: unpublished.rows };
    });
    expect(rows.published).toEqual([
      { lang: 'es', slug: 'informe', translation_of_lang: null, translation_of_slug: null },
      { lang: 'en', slug: 'report', translation_of_lang: 'es', translation_of_slug: 'informe' },
    ]);
    expect(rows.unpublished).toEqual([{ lang: 'en', slug: 'retirado' }]);
  });

  it('keeps a story to one original when two pushes race (the trigger serialises translation writes)', async () => {
    const connect = async () => {
      const client = new pg.Client({ connectionString: superuserUrl() });
      await client.connect();
      return client;
    };
    const setup = await connect();
    const [first, second] = [await connect(), await connect()];
    const cleanup = async () => {
      await setup.query(
        "DELETE FROM app.posts WHERE slug LIKE 'race-%' AND translation_of_lang IS NOT NULL",
      );
      await setup.query("DELETE FROM app.posts WHERE slug LIKE 'race-%'");
    };
    try {
      await cleanup();
      await insertPost(setup, 'race-a');
      await insertPost(setup, 'race-d', { lang: 'en' });
      // The first makes es/race-a a translation of en/race-d; the second, at the same time, translates es/race-a.
      // Each one's checks pass on what it sees; only one may commit.
      await first.query('BEGIN');
      await second.query('BEGIN');
      await first.query(
        `UPDATE app.posts SET translation_of_lang = 'en', translation_of_slug = 'race-d'
         WHERE lang = 'es' AND slug = 'race-a'`,
      );
      const racing = second
        .query(INSERT_POST, postValues('race-b', { lang: 'en', translation_of: 'es/race-a' }))
        .then(
          () => null,
          (error: { constraint?: string }) => error.constraint ?? 'failed',
        );
      await new Promise((resolve) => setTimeout(resolve, 200));
      await first.query('COMMIT');
      expect(await racing).toBe('posts_translation_of_original');
      await second.query('ROLLBACK');
    } finally {
      await Promise.all([first.end(), second.end()]);
      await cleanup();
      await setup.end();
    }
  });
});
