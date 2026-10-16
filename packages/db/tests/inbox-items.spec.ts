import type pg from 'pg';

import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';

const asApp = <T>(fn: (client: pg.Client) => Promise<T>): Promise<T> =>
  inRolledBackTransaction(async (client) => {
    await client.query('SET LOCAL ROLE newsroom_app');
    return fn(client);
  });

const insertLink = async (client: pg.Client, url: string): Promise<string> => {
  const { rows } = await client.query<{ id: string }>(
    'INSERT INTO app.inbox_items (url, url_normalized) VALUES ($1, $1) RETURNING id',
    [url],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error('no id returned');
  }
  return id;
};

describe('app.inbox_items', () => {
  it('keeps one item per normalised link (R-CAP-6)', async () => {
    await asApp(async (client) => {
      await insertLink(client, 'https://example.com/a');
      expect(
        await failure(
          client,
          `INSERT INTO app.inbox_items (url, url_normalized) VALUES ('https://example.com/a?utm_source=x', $1)`,
          ['https://example.com/a'],
        ),
      ).toEqual({ code: '23505', constraint: 'inbox_items_url_normalized_key' });
    });
  });

  it('allows any number of notes without a link', async () => {
    await asApp(async (client) => {
      for (const note of ['one', 'two']) {
        expect(
          await failure(
            client,
            `INSERT INTO app.inbox_items (note, status) VALUES ($1, 'needs_review')`,
            [note],
          ),
        ).toBeNull();
      }
    });
  });

  it('sends a note without a link to needs_review, never queued or ready (R-CAP-4)', async () => {
    await asApp(async (client) => {
      for (const status of ['queued', 'ready']) {
        expect(
          await failure(
            client,
            `INSERT INTO app.inbox_items (note, status) VALUES ('a note', $1)`,
            [status],
          ),
        ).toEqual({ code: '23514', constraint: 'inbox_items_note_needs_review' });
      }
    });
  });

  it('needs both forms of a link, or neither', async () => {
    await asApp(async (client) => {
      expect(
        await failure(client, `INSERT INTO app.inbox_items (url) VALUES ('https://example.com/a')`),
      ).toEqual({ code: '23514', constraint: 'inbox_items_url_pair' });
    });
  });

  it('logs an item only with a pointer into aisafety-media', async () => {
    await asApp(async (client) => {
      const id = await insertLink(client, 'https://example.com/a');
      await client.query(`UPDATE app.inbox_items SET status = 'ready' WHERE id = $1`, [id]);
      expect(
        await failure(client, `UPDATE app.inbox_items SET status = 'logged' WHERE id = $1`, [id]),
      ).toEqual({
        code: '23514',
        constraint: 'inbox_items_logged_has_ref',
      });
      expect(
        await failure(
          client,
          `UPDATE app.inbox_items SET status = 'logged', logged_at = now(), logged_ref = '[]' WHERE id = $1`,
          [id],
        ),
      ).toEqual({ code: '23514', constraint: 'inbox_items_logged_ref_object' });
      expect(
        await failure(
          client,
          `UPDATE app.inbox_items SET status = 'logged', logged_at = now(), logged_ref = $2 WHERE id = $1`,
          [
            id,
            {
              news_file: 'news/2026-10.md',
              entry_date: '2026-10-15',
              tags: ['labs'],
              relevance: 'high',
            },
          ],
        ),
      ).toBeNull();
    });
  });

  it('takes a follow-up only as a note pointing at an item (R-CAP-6)', async () => {
    await asApp(async (client) => {
      const original = await insertLink(client, 'https://example.com/a');
      expect(
        await failure(
          client,
          `INSERT INTO app.inbox_items (note, status, follows_up) VALUES ('now confirmed', 'needs_review', $1)`,
          [original],
        ),
      ).toBeNull();
      expect(
        await failure(
          client,
          `INSERT INTO app.inbox_items (url, url_normalized, follows_up) VALUES ('https://b.example', 'https://b.example', $1)`,
          [original],
        ),
      ).toEqual({ code: '23514', constraint: 'inbox_items_follow_up_is_a_note' });
      expect(
        await failure(
          client,
          `INSERT INTO app.inbox_items (note, status, follows_up) VALUES ('about nothing', 'needs_review', 999999)`,
        ),
      ).toMatchObject({ code: '23503' });
    });
  });

  it('caps the stored page text at 20,000 characters', async () => {
    await asApp(async (client) => {
      const id = await insertLink(client, 'https://example.com/a');
      expect(
        await failure(client, 'UPDATE app.inbox_items SET page_text = $2 WHERE id = $1', [
          id,
          'x'.repeat(20000),
        ]),
      ).toBeNull();
      expect(
        await failure(client, 'UPDATE app.inbox_items SET page_text = $2 WHERE id = $1', [
          id,
          'x'.repeat(20001),
        ]),
      ).toEqual({ code: '23514', constraint: 'inbox_items_page_text_length' });
    });
  });

  it('knows a fetched link as a page or a video, and only a video has a length (R-FET-7)', async () => {
    await asApp(async (client) => {
      const id = await insertLink(client, 'https://example.com/a');
      const set = (columns: string, values: unknown[]) =>
        failure(client, `UPDATE app.inbox_items SET ${columns} WHERE id = $1`, [id, ...values]);
      expect(await set('page_kind = $2', ['podcast'])).toEqual({
        code: '23514',
        constraint: 'inbox_items_page_kind_known',
      });
      expect(await set('page_kind = $2', ['page'])).toBeNull();
      expect(
        await set('page_kind = $2, page_author = $3, page_duration_seconds = $4', [
          'video',
          'Canal de ejemplo',
          754,
        ]),
      ).toBeNull();
      expect(await set('page_duration_seconds = $2', [0])).toEqual({
        code: '23514',
        constraint: 'inbox_items_page_duration_positive',
      });
      expect(await set('page_kind = $2, page_duration_seconds = $3', ['page', 60])).toEqual({
        code: '23514',
        constraint: 'inbox_items_page_duration_of_video',
      });
    });
  });

  it('stamps updated_at on every change', async () => {
    await inRolledBackTransaction(async (client) => {
      const id = await insertLink(client, 'https://example.com/a');
      await client.query(`UPDATE app.inbox_items SET updated_at = '2026-01-01' WHERE id = $1`, [
        id,
      ]);
      await client.query(`UPDATE app.inbox_items SET note = 'more' WHERE id = $1`, [id]);
      const { rows } = await client.query<{ fresh: boolean }>(
        'SELECT updated_at = now() AS fresh FROM app.inbox_items WHERE id = $1',
        [id],
      );
      expect(rows[0]?.fresh).toBe(true);
    });
  });
});
