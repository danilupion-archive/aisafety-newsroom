import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { Extracted } from './extract.js';

/** A queued item the worker has claimed: its attempt is already counted (R-FET-5). */
export interface Claimed {
  id: number;
  url: string;
  /** This one included. */
  attempts: number;
}

/** Attempts before an item goes to needs_review (R-FET-2), counting the ones a crash cut short (R-FET-5). */
export const MAX_ATTEMPTS = 3;

/** How long a claim holds an item: past it, an item a crashed worker held is due again, its attempt counted. */
export const LEASE_MINUTES = 10;

/**
 * Where an item's "Saved #n" reply is, to edit it (R-CAP-7). Read when the item is stored, not when it's claimed: the
 * bot remembers the reply only once Telegram has sent it.
 */
export interface ReplyTarget {
  chatId: number;
  messageId: number;
}

/** A save that went through, with the reply to edit if there is one; undefined if the item had left the queue. */
export type Saved = { reply: ReplyTarget | null } | undefined;

interface ReplyColumns {
  reply_chat_id: string | null;
  reply_message_id: string | null;
}

const replyOf = (row: ReplyColumns): ReplyTarget | null =>
  row.reply_chat_id === null || row.reply_message_id === null
    ? null
    : { chatId: Number(row.reply_chat_id), messageId: Number(row.reply_message_id) };

const saved = (row: ReplyColumns | undefined): Saved =>
  row === undefined ? undefined : { reply: replyOf(row) };

/**
 * Claims up to `limit` queued items that are due (R-FET-1): `FOR UPDATE SKIP LOCKED`, so overlapping claims never take
 * the same item. Each claim counts an attempt and holds the item for LEASE_MINUTES, before anything is fetched, so a
 * page that crashes the worker runs out of attempts instead of looping (R-FET-5): an item with none left isn't
 * claimed, and `abandonCrashed` takes it out of the queue.
 */
export const claimDue = async (db: Database, limit = 1): Promise<Claimed[]> => {
  const { rows } = await sql<{ id: string; url: string; fetch_attempts: number }>`
    UPDATE app.inbox_items
    SET fetch_attempts = fetch_attempts + 1,
        next_fetch_at = now() + make_interval(mins => ${LEASE_MINUTES})
    WHERE id IN (
      SELECT id FROM app.inbox_items
      WHERE status = 'queued' AND url IS NOT NULL AND fetch_attempts < ${MAX_ATTEMPTS}
        AND (next_fetch_at IS NULL OR next_fetch_at <= now())
      ORDER BY next_fetch_at NULLS FIRST, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, url, fetch_attempts
  `.execute(db);
  return rows
    .map((row) => ({ id: Number(row.id), url: row.url, attempts: row.fetch_attempts }))
    .sort((a, b) => a.id - b.id);
};

/**
 * R-FET-5: an item whose attempts all ended with no result, because the worker died fetching it (out of memory,
 * killed by its liveness probe), goes to needs_review once its last lease runs out, instead of waiting in the queue
 * for ever. Returns them, to edit their replies.
 */
export const abandonCrashed = async (
  db: Database,
): Promise<{ id: number; reply: ReplyTarget | null }[]> => {
  const { rows } = await sql<{ id: string } & ReplyColumns>`
    UPDATE app.inbox_items
    SET status = 'needs_review', fetch_status = 'failed', last_error = 'crashed', next_fetch_at = NULL
    WHERE status = 'queued' AND url IS NOT NULL AND fetch_attempts >= ${MAX_ATTEMPTS}
      AND next_fetch_at <= now()
    RETURNING id, reply_chat_id, reply_message_id
  `.execute(db);
  return rows.map((row) => ({ id: Number(row.id), reply: replyOf(row) }));
};

export interface Page {
  status: number;
  finalUrl: string;
  contentType: string | undefined;
  extracted: Extracted;
}

/**
 * Stores a fetched page and makes the item ready. Only while it's still queued: an item discarded meanwhile stays
 * discarded.
 */
export const saveFetched = async (db: Database, id: number, page: Page): Promise<Saved> => {
  const row = await db
    .updateTable('app.inbox_items')
    .set({
      status: 'ready',
      fetch_status: 'ok',
      http_status: page.status,
      final_url: page.finalUrl,
      content_type: page.contentType ?? null,
      page_title: page.extracted.title,
      page_site_name: page.extracted.siteName,
      page_published_at: page.extracted.publishedAt,
      page_text: page.extracted.text,
      page_kind: page.extracted.video ? 'video' : 'page',
      page_author: page.extracted.video?.author ?? null,
      page_duration_seconds: page.extracted.video?.durationSeconds ?? null,
      fetched_at: sql<Date>`now()`,
      next_fetch_at: null,
      last_error: null,
    })
    .where('id', '=', String(id))
    .where('status', '=', 'queued')
    .returning(['reply_chat_id', 'reply_message_id'])
    .executeTakeFirst();
  return saved(row);
};

/** A host the worker doesn't fetch (R-FET-3): the item is ready, and relies on its note. */
export const markSkipped = async (db: Database, id: number): Promise<Saved> => {
  const row = await db
    .updateTable('app.inbox_items')
    .set({ status: 'ready', fetch_status: 'skipped', next_fetch_at: null })
    .where('id', '=', String(id))
    .where('status', '=', 'queued')
    .returning(['reply_chat_id', 'reply_message_id'])
    .executeTakeFirst();
  return saved(row);
};

/**
 * Records a failed fetch: tried again after `retryInMinutes`, or, with no retry left, sent to needs_review with
 * `fetch_status: failed` (R-FET-2).
 */
export const saveFailure = async (
  db: Database,
  id: number,
  error: string,
  retryInMinutes: number | undefined,
): Promise<Saved> => {
  const row = await db
    .updateTable('app.inbox_items')
    .set(
      retryInMinutes === undefined
        ? { status: 'needs_review', fetch_status: 'failed', last_error: error, next_fetch_at: null }
        : {
            last_error: error,
            next_fetch_at: sql<Date>`now() + make_interval(mins => ${retryInMinutes})`,
          },
    )
    .where('id', '=', String(id))
    .where('status', '=', 'queued')
    .returning(['reply_chat_id', 'reply_message_id'])
    .executeTakeFirst();
  return saved(row);
};

/** How many items have waited in the queue longer than an hour (SPEC §15, monitoring). */
export const staleQueued = async (db: Database): Promise<number> => {
  const row = await db
    .selectFrom('app.inbox_items')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('status', '=', 'queued')
    .where('created_at', '<', sql<Date>`now() - interval '1 hour'`)
    .executeTakeFirstOrThrow();
  return Number(row.count);
};

/**
 * Q9: a page's text is kept only while `/news` may need it. Once an item has been logged or discarded, and hasn't
 * changed for `days`, its text is cleared; its title, outlet, date and addresses stay, and the news log in aisafety-media
 * is the record (P1). An item restored after that has no text, and `/news` fetches the page again (R-MED-2). Returns how
 * many items it cleared.
 */
export const clearOldPageText = async (db: Database, days: number): Promise<number> => {
  const result = await db
    .updateTable('app.inbox_items')
    .set({ page_text: null })
    .where('page_text', 'is not', null)
    .where('status', 'in', ['logged', 'discarded'])
    .where('updated_at', '<', sql<Date>`now() - make_interval(days => ${days})`)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
};
