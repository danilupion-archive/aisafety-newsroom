import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { Extracted } from './extract.js';

/** A queued item the worker has claimed: its attempt is already counted (R-FET-5). */
export interface Claimed {
  id: number;
  url: string;
  /** This one included. */
  attempts: number;
  replyChatId: number | null;
  replyMessageId: number | null;
}

/** How long a claim holds an item: past it, an item a crashed worker held is due again, its attempt counted. */
export const LEASE_MINUTES = 10;

/**
 * Claims up to `limit` queued items that are due (R-FET-1): `FOR UPDATE SKIP LOCKED`, so overlapping claims never take
 * the same item. Each claim counts an attempt and holds the item for LEASE_MINUTES, before anything is fetched, so a
 * page that crashes the worker runs out of attempts instead of looping (R-FET-5).
 */
export const claimDue = async (db: Database, limit = 10): Promise<Claimed[]> => {
  const { rows } = await sql<{
    id: string;
    url: string;
    fetch_attempts: number;
    reply_chat_id: string | null;
    reply_message_id: string | null;
  }>`
    UPDATE app.inbox_items
    SET fetch_attempts = fetch_attempts + 1,
        next_fetch_at = now() + make_interval(mins => ${LEASE_MINUTES})
    WHERE id IN (
      SELECT id FROM app.inbox_items
      WHERE status = 'queued' AND url IS NOT NULL AND (next_fetch_at IS NULL OR next_fetch_at <= now())
      ORDER BY next_fetch_at NULLS FIRST, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, url, fetch_attempts, reply_chat_id, reply_message_id
  `.execute(db);
  return rows
    .map((row) => ({
      id: Number(row.id),
      url: row.url,
      attempts: row.fetch_attempts,
      replyChatId: row.reply_chat_id === null ? null : Number(row.reply_chat_id),
      replyMessageId: row.reply_message_id === null ? null : Number(row.reply_message_id),
    }))
    .sort((a, b) => a.id - b.id);
};

export interface Page {
  status: number;
  finalUrl: string;
  contentType: string | undefined;
  extracted: Extracted;
}

/**
 * Stores a fetched page and makes the item ready. Only while it's still queued: an item discarded meanwhile stays
 * discarded. True if it was stored.
 */
export const saveFetched = async (db: Database, id: number, page: Page): Promise<boolean> => {
  const result = await db
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
      fetched_at: sql<Date>`now()`,
      next_fetch_at: null,
      last_error: null,
    })
    .where('id', '=', String(id))
    .where('status', '=', 'queued')
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
};

/** A host the worker doesn't fetch (R-FET-3): the item is ready, and relies on its note. True if it was stored. */
export const markSkipped = async (db: Database, id: number): Promise<boolean> => {
  const result = await db
    .updateTable('app.inbox_items')
    .set({ status: 'ready', fetch_status: 'skipped', next_fetch_at: null })
    .where('id', '=', String(id))
    .where('status', '=', 'queued')
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
};

/**
 * Records a failed fetch: tried again after `retryInMinutes`, or, with no retry left, sent to needs_review with
 * `fetch_status: failed` (R-FET-2). True if it was stored.
 */
export const saveFailure = async (
  db: Database,
  id: number,
  error: string,
  retryInMinutes: number | undefined,
): Promise<boolean> => {
  const result = await db
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
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
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
