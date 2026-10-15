import type pg from 'pg';

import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';

const insertPost = (client: pg.Client, slug: string, extra: Record<string, string> = {}) =>
  client.query(
    `INSERT INTO app.posts (slug, type, title, body_md, published_at, content_ref, unpublished_at)
     VALUES ($1, 'breve', 'Un título de ejemplo', 'Texto de ejemplo.', $2, '{"path": "posts/x.md"}', $3)`,
    [slug, extra.published_at ?? '2026-10-01', extra.unpublished_at ?? null],
  );

describe('app.posts', () => {
  it('takes only slugs made of lowercase words and hyphens', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      for (const slug of ['Con-Mayusculas', 'con espacio', 'acentuó', '-guion', 'doble--guion']) {
        expect(
          await failure(
            client,
            `INSERT INTO app.posts (slug, type, title, body_md, published_at, content_ref)
             VALUES ($1, 'breve', 't', 'b', now(), '{}')`,
            [slug],
          ),
        ).toEqual({ code: '23514', constraint: 'posts_slug_format' });
      }
    });
  });

  it('shows newsroom_public published posts only, and never where they came from', async () => {
    const visible = await inRolledBackTransaction(async (client) => {
      await insertPost(client, 'publicada');
      await insertPost(client, 'programada', { published_at: '2999-01-01' });
      await insertPost(client, 'retirada', { unpublished_at: '2026-10-10' });
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query<Record<string, unknown>>(
        'SELECT * FROM app.published_posts',
      );
      const unpublished = await client.query<{ slug: string }>(
        'SELECT slug FROM app.unpublished_posts',
      );
      expect(await failure(client, 'SELECT FROM app.posts')).toEqual({ code: '42501' });
      return { published: published.rows, unpublished: unpublished.rows.map((row) => row.slug) };
    });
    expect(visible.published.map((post) => post.slug)).toEqual(['publicada']);
    expect(visible.published[0]).not.toHaveProperty('content_ref');
    expect(visible.published[0]).not.toHaveProperty('unpublished_at');
    expect(visible.unpublished).toEqual(['retirada']);
  });
});
