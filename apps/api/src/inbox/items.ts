import type { Database, DB } from '@aisafety-newsroom/db/client';

import {
  canTransition,
  type FetchStatus,
  type InboxStatus,
  restoredStatus,
} from '@aisafety-newsroom/domain/inbox';
import { appendNote } from '@aisafety-newsroom/domain/notes';
import { type Selectable, sql, type Transaction } from 'kysely';

/** What `/news` records about an item it logged: a pointer into aisafety-media, which is the record (P1). */
export type LoggedRef = {
  news_file: string;
  entry_date: string;
  tags: string[];
  relevance: 'high' | 'medium' | 'low';
};

/** The item a follow-up is about (R-CAP-6), so `/news` can find its entry. */
export interface Original {
  id: number;
  url: string | null;
  status: InboxStatus;
  page_title: string | null;
  logged_ref: unknown;
}

/** An item as the API returns it (§9): the table's columns, less the bot's own bookkeeping. */
export interface Item {
  id: number;
  created_at: Date;
  updated_at: Date;
  submitted_by: number | null;
  source: string;
  raw_text: string;
  url: string | null;
  url_normalized: string | null;
  note: string;
  follows_up: Original | null;
  status: InboxStatus;
  fetch_status: FetchStatus;
  fetch_attempts: number;
  http_status: number | null;
  final_url: string | null;
  content_type: string | null;
  page_title: string | null;
  page_site_name: string | null;
  page_published_at: string | null;
  fetched_at: Date | null;
  logged_at: Date | null;
  logged_ref: unknown;
  discard_reason: string | null;
  last_error: string | null;
}

export type ItemDetail = Item & { page_text: string | null };
/** In lists: the first 4,000 characters of the page's text, not all of it (§9). */
export type ItemSummary = Item & { page_excerpt: string | null };

export type Outcome =
  { ok: true; item: ItemDetail } | { ok: false; error: 'not_found' | 'conflict'; message: string };

type Executor = Database | Transaction<DB>;
type ItemRow = Selectable<DB['app.inbox_items']>;

export const PAGE_EXCERPT_LENGTH = 4000;

const itemQuery = (db: Executor) =>
  db
    .selectFrom('app.inbox_items as i')
    .leftJoin('app.inbox_items as o', 'o.id', 'i.follows_up')
    .select([
      'i.id',
      'i.created_at',
      'i.updated_at',
      'i.submitted_by',
      'i.source',
      'i.raw_text',
      'i.url',
      'i.url_normalized',
      'i.note',
      'i.status',
      'i.fetch_status',
      'i.fetch_attempts',
      'i.http_status',
      'i.final_url',
      'i.content_type',
      'i.page_title',
      'i.page_site_name',
      'i.page_published_at',
      'i.fetched_at',
      'i.logged_at',
      'i.logged_ref',
      'i.discard_reason',
      'i.last_error',
      'o.id as original_id',
      'o.url as original_url',
      'o.status as original_status',
      'o.page_title as original_page_title',
      'o.logged_ref as original_logged_ref',
    ]);

type QueryRow = Omit<
  ItemRow,
  'page_text' | 'next_fetch_at' | 'reply_chat_id' | 'reply_message_id' | 'follows_up'
> & {
  original_id: string | null;
  original_url: string | null;
  original_status: InboxStatus | null;
  original_page_title: string | null;
  original_logged_ref: unknown;
};

const toItem = (row: QueryRow): Item => ({
  id: Number(row.id),
  created_at: row.created_at,
  updated_at: row.updated_at,
  submitted_by: row.submitted_by === null ? null : Number(row.submitted_by),
  source: row.source,
  raw_text: row.raw_text,
  url: row.url,
  url_normalized: row.url_normalized,
  note: row.note,
  follows_up:
    row.original_id === null || row.original_status === null
      ? null
      : {
          id: Number(row.original_id),
          url: row.original_url,
          status: row.original_status,
          page_title: row.original_page_title,
          logged_ref: row.original_logged_ref,
        },
  status: row.status,
  fetch_status: row.fetch_status,
  fetch_attempts: row.fetch_attempts,
  http_status: row.http_status,
  final_url: row.final_url,
  content_type: row.content_type,
  page_title: row.page_title,
  page_site_name: row.page_site_name,
  page_published_at: row.page_published_at,
  fetched_at: row.fetched_at,
  logged_at: row.logged_at,
  logged_ref: row.logged_ref,
  discard_reason: row.discard_reason,
  last_error: row.last_error,
});

/** Items in the given statuses, oldest first, without their page text (§9 `GET /items`). */
export const listItems = async (
  db: Executor,
  { statuses, limit }: { statuses: readonly InboxStatus[]; limit: number },
): Promise<ItemSummary[]> => {
  const rows = await itemQuery(db)
    .select(sql<string | null>`substr(i.page_text, 1, ${PAGE_EXCERPT_LENGTH})`.as('page_excerpt'))
    .where('i.status', 'in', statuses)
    .orderBy('i.id')
    .limit(limit)
    .execute();
  return rows.map((row) => ({ ...toItem(row), page_excerpt: row.page_excerpt }));
};

/** One item with its page text, or undefined (§9 `GET /items/:id`). */
export const getItem = async (db: Executor, id: number): Promise<ItemDetail | undefined> => {
  const row = await itemQuery(db)
    .select('i.page_text')
    .where('i.id', '=', String(id))
    .executeTakeFirst();
  return row ? { ...toItem(row), page_text: row.page_text } : undefined;
};

const lock = (trx: Transaction<DB>, id: number) =>
  trx
    .selectFrom('app.inbox_items')
    .select(['id', 'status', 'fetch_status', 'url', 'note'])
    .where('id', '=', String(id))
    .forUpdate()
    .executeTakeFirst();

const notFound = (id: number): Outcome => ({
  ok: false,
  error: 'not_found',
  message: `No item #${id}`,
});

const conflict = (id: number, from: InboxStatus, action: string): Outcome => ({
  ok: false,
  error: 'conflict',
  message: `Item #${id} is ${from}: it can't be ${action}`,
});

const done = async (trx: Transaction<DB>, id: number): Promise<Outcome> => {
  const item = await getItem(trx, id);
  return item ? { ok: true, item } : notFound(id);
};

/**
 * Marks an item logged (§9 `POST /items/:id/logged`). Logging it again only updates the pointer into aisafety-media,
 * so a repeat is harmless (R-API-3, R-DB-1).
 */
export const markLogged = (db: Database, id: number, ref: LoggedRef): Promise<Outcome> =>
  db.transaction().execute(async (trx) => {
    const row = await lock(trx, id);
    if (!row) {
      return notFound(id);
    }
    if (!canTransition(row.status, 'logged')) {
      return conflict(id, row.status, 'logged');
    }
    await trx
      .updateTable('app.inbox_items')
      .set({ status: 'logged', logged_ref: ref, logged_at: sql`coalesce(logged_at, now())` })
      .where('id', '=', String(id))
      .execute();
    return done(trx, id);
  });

/** Marks an item discarded (§9 `POST /items/:id/discarded`, the bot's `/discard`). A logged item stays logged. */
export const markDiscarded = (db: Database, id: number, reason: string | null): Promise<Outcome> =>
  db.transaction().execute(async (trx) => {
    const row = await lock(trx, id);
    if (!row) {
      return notFound(id);
    }
    if (!canTransition(row.status, 'discarded')) {
      return conflict(id, row.status, 'discarded');
    }
    await trx
      .updateTable('app.inbox_items')
      .set({ status: 'discarded', discard_reason: reason })
      .where('id', '=', String(id))
      .execute();
    return done(trx, id);
  });

/**
 * Brings a discarded item back to where it would be now (R-DB-1): queued if never fetched, ready if fetched or skipped,
 * needs_review otherwise. An item that isn't discarded is left as it is, unless it's logged.
 */
export const restore = (db: Database, id: number): Promise<Outcome> =>
  db.transaction().execute(async (trx) => {
    const row = await lock(trx, id);
    if (!row) {
      return notFound(id);
    }
    if (row.status === 'logged') {
      return conflict(id, row.status, 'restored');
    }
    if (row.status === 'discarded') {
      const status = restoredStatus({ hasUrl: row.url !== null, fetchStatus: row.fetch_status });
      await trx
        .updateTable('app.inbox_items')
        .set({
          status,
          discard_reason: null,
          ...(status === 'queued' ? { next_fetch_at: sql<Date>`now()` } : {}),
        })
        .where('id', '=', String(id))
        .execute();
    }
    return done(trx, id);
  });

/** Adds a timestamped entry to an item's note (§9 `POST /items/:id/note`, the bot's `/note`); a repeat adds nothing. */
export const addNote = (
  db: Database,
  id: number,
  text: string,
  at = new Date(),
): Promise<Outcome> =>
  db.transaction().execute(async (trx) => {
    const row = await lock(trx, id);
    if (!row) {
      return notFound(id);
    }
    const note = appendNote(row.note, text, at);
    if (note !== row.note) {
      await trx.updateTable('app.inbox_items').set({ note }).where('id', '=', String(id)).execute();
    }
    return done(trx, id);
  });
