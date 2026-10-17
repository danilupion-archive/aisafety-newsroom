import type { Database, DB } from '@aisafety-newsroom/db/client';
import type { CapturedLink } from '@aisafety-newsroom/domain/telegram';

import { duplicateAction, type InboxStatus, type Intent } from '@aisafety-newsroom/domain/inbox';
import { appendNote } from '@aisafety-newsroom/domain/notes';
import { sql, type Transaction } from 'kysely';

import type { Labelled } from './replies.js';

type Executor = Database | Transaction<DB>;

/** Who sent a message, what it said, and when. */
export interface Sender {
  submittedBy: number;
  rawText: string;
  note: string;
  at: Date;
}

export type CaptureResult =
  | { kind: 'saved'; id: number }
  | { kind: 'note_saved'; id: number }
  | { kind: 'appended'; id: number; status: InboxStatus }
  | { kind: 'follow_up'; id: number; original: number; originalStatus: InboxStatus }
  | { kind: 'already'; id: number; status: InboxStatus };

/**
 * A new item waits this long before the worker may claim it, so the "Saved #n" reply goes out and is remembered
 * first, and the worker can edit it (R-CAP-7). Well inside the 2 minutes of AC-1.
 */
export const REPLY_GRACE_SECONDS = 10;

/** Records an update; false if it was already processed, so a redelivery changes nothing (R-CAP-2). */
export const recordUpdate = async (db: Executor, updateId: number): Promise<boolean> => {
  const row = await db
    .insertInto('app.telegram_updates')
    .values({ update_id: String(updateId) })
    .onConflict((conflict) => conflict.column('update_id').doNothing())
    .returning('update_id')
    .executeTakeFirst();
  return row !== undefined;
};

export const wasProcessed = async (db: Executor, updateId: number): Promise<boolean> =>
  (await db
    .selectFrom('app.telegram_updates')
    .select('update_id')
    .where('update_id', '=', String(updateId))
    .executeTakeFirst()) !== undefined;

const noteOnly = (trx: Transaction<DB>, sender: Sender, followsUp: string | null) =>
  trx
    .insertInto('app.inbox_items')
    .values({
      submitted_by: String(sender.submittedBy),
      raw_text: sender.rawText,
      note: appendNote('', sender.note, sender.at),
      status: 'needs_review',
      follows_up: followsUp,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

/**
 * Saves a link as a queued item (R-CAP-3, R-CAP-5), to be posted unless `intent` says log only (D18), or, if it's
 * already in the inbox, appends the note to it, makes a follow-up of a note about a logged or discarded item, or does
 * nothing (R-CAP-6). An existing item's intent is the caller's to change.
 */
export const captureLink = async (
  trx: Transaction<DB>,
  link: CapturedLink,
  sender: Sender,
  intent: Intent = 'post',
): Promise<CaptureResult> => {
  const inserted = await trx
    .insertInto('app.inbox_items')
    .values({
      submitted_by: String(sender.submittedBy),
      raw_text: sender.rawText,
      url: link.url,
      url_normalized: link.normalized,
      note: appendNote('', sender.note, sender.at),
      status: 'queued',
      intent,
      next_fetch_at: sql<Date>`now() + make_interval(secs => ${REPLY_GRACE_SECONDS})`,
    })
    .onConflict((conflict) =>
      conflict.column('url_normalized').where('url_normalized', 'is not', null).doNothing(),
    )
    .returning('id')
    .executeTakeFirst();
  if (inserted) {
    return { kind: 'saved', id: Number(inserted.id) };
  }

  const existing = await trx
    .selectFrom('app.inbox_items')
    .select(['id', 'status', 'note'])
    .where('url_normalized', '=', link.normalized)
    .forUpdate()
    .executeTakeFirstOrThrow();
  const id = Number(existing.id);
  switch (duplicateAction(existing.status, sender.note)) {
    case 'append_note': {
      const note = appendNote(existing.note, sender.note, sender.at);
      if (note !== existing.note) {
        await trx
          .updateTable('app.inbox_items')
          .set({ note })
          .where('id', '=', existing.id)
          .execute();
      }
      return { kind: 'appended', id, status: existing.status };
    }
    case 'follow_up': {
      const followUp = await noteOnly(trx, sender, existing.id);
      return {
        kind: 'follow_up',
        id: Number(followUp.id),
        original: id,
        originalStatus: existing.status,
      };
    }
    case 'reply_only':
      return { kind: 'already', id, status: existing.status };
  }
};

/**
 * A note about an item already logged or discarded (the bot's `/note`): a follow-up, as when its link comes again
 * (R-CAP-6), since `/news` only reads open items. Returns the follow-up's id.
 */
export const captureFollowUp = (
  db: Database,
  originalId: number,
  sender: Sender,
): Promise<number> =>
  db
    .transaction()
    .execute(async (trx) => Number((await noteOnly(trx, sender, String(originalId))).id));

/** Saves a message without a link as a note, straight to needs_review (R-CAP-4). */
export const captureNote = async (trx: Transaction<DB>, sender: Sender): Promise<CaptureResult> => {
  const row = await noteOnly(trx, sender, null);
  return { kind: 'note_saved', id: Number(row.id) };
};

/** Remembers the "Saved #n" reply, so the worker can edit it once the page is fetched (R-CAP-7). */
export const rememberReply = async (
  db: Executor,
  id: number,
  chatId: number,
  messageId: number,
): Promise<void> => {
  await db
    .updateTable('app.inbox_items')
    .set({ reply_chat_id: String(chatId), reply_message_id: String(messageId) })
    .where('id', '=', String(id))
    .execute();
};

/** Up to `limit` unlogged items, oldest first (R-CAP-8 `/pending`). */
export const pendingItems = async (
  db: Executor,
  limit = 20,
): Promise<(Labelled & { status: InboxStatus; intent: Intent })[]> => {
  const rows = await db
    .selectFrom('app.inbox_items')
    .select(['id', 'status', 'intent', 'page_title', 'url'])
    .where('status', 'in', ['queued', 'ready', 'needs_review'])
    .orderBy('id')
    .limit(limit)
    .execute();
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
};
