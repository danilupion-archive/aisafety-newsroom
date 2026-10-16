import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';
import { superuserUrl } from './env.js';

const INSERT_POST = `INSERT INTO app.posts
    (slug, lang, translation_of_lang, translation_of_slug, type, title, body_md, published_at, content_ref, unpublished_at)
  VALUES ($1, $2, $3, $4, $7, 'Un título de ejemplo', 'Texto de ejemplo.', $5, '{"path": "posts/x.md"}', $6)`;

const postValues = (slug: string, extra: Record<string, string> = {}) => [
  slug,
  extra.lang ?? 'es',
  extra.translation_of?.split('/')[0] ?? null,
  extra.translation_of?.split('/')[1] ?? null,
  extra.published_at ?? '2026-10-01',
  extra.unpublished_at ?? null,
  extra.type ?? 'breve',
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
            `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref)
             VALUES ($1, 'es', 'breve', 't', 'b', now(), '{}')`,
            [slug],
          ),
        ).toEqual({ code: '23514', constraint: 'posts_slug_format' });
      }
    });
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
