import { createDatabase, type Database } from '@aisafety-newsroom/db/client';
import pg from 'pg';

import { appUrl, publicUrl, superuserUrl } from './env.js';

/** The API's database, as newsroom_app. Close it in afterAll. */
export const appDatabase = (): Database =>
  createDatabase({ connectionString: appUrl(), maxConnections: 4 });

/** The site's database, as newsroom_public. Close it in afterAll. */
export const publicDatabase = (): Database =>
  createDatabase({ connectionString: publicUrl(), maxConnections: 2 });

/** Runs SQL as the superuser, outside the API: emptying tables, or putting rows in states the API can't reach. */
export const asSuperuser = async <T extends pg.QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> => {
  const client = new pg.Client({ connectionString: superuserUrl() });
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
};

export const emptyTables = (): Promise<unknown> =>
  asSuperuser('TRUNCATE app.inbox_items, app.telegram_updates, app.posts RESTART IDENTITY CASCADE');

export interface Fixture {
  url?: string | null;
  status?: string;
  fetch_status?: string;
  note?: string;
  page_text?: string | null;
  page_title?: string | null;
  follows_up?: number | null;
  logged_ref?: unknown;
}

/** Inserts an item directly, in any state, and returns its id. */
export const insertItem = async (fixture: Fixture = {}): Promise<number> => {
  const url =
    fixture.url === undefined
      ? `https://example.com/${Math.random().toString(36).slice(2)}`
      : fixture.url;
  const status = fixture.status ?? (url === null ? 'needs_review' : 'ready');
  const [row] = await asSuperuser<{ id: string }>(
    `INSERT INTO app.inbox_items
       (url, url_normalized, status, fetch_status, note, page_text, page_title, follows_up, logged_ref, logged_at)
     VALUES ($1, $1, $2::app.inbox_status, $3::app.fetch_status, $4, $5, $6, $7, $8, CASE WHEN $2::text = 'logged' THEN now() END)
     RETURNING id`,
    [
      url,
      status,
      fixture.fetch_status ?? (url === null ? 'pending' : 'ok'),
      fixture.note ?? '',
      fixture.page_text ?? null,
      fixture.page_title ?? null,
      fixture.follows_up ?? null,
      fixture.logged_ref === undefined
        ? status === 'logged'
          ? { news_file: 'news/2026-10.md' }
          : null
        : fixture.logged_ref,
    ],
  );
  return Number(row?.id);
};
