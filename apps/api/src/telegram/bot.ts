import type { Database } from '@aisafety-newsroom/db/client';

import { type Intent, isOpen } from '@aisafety-newsroom/domain/inbox';
import {
  type Command,
  extractCapture,
  parseCommand,
  type TelegramMessage,
} from '@aisafety-newsroom/domain/telegram';

import type { TelegramApi } from './api.js';

import {
  addNote,
  getItem,
  type IntentOutcome,
  type ItemDetail,
  markDiscarded,
  type Outcome,
  restore,
  setIntent,
  setIntentIn,
} from '../inbox/items.js';
import {
  captureFollowUp,
  captureLink,
  captureNote,
  type CaptureResult,
  pendingItems,
  recordUpdate,
  rememberReply,
  type Sender,
  wasProcessed,
} from './capture.js';
import { HELP, label, LOG_ONLY, pendingList } from './replies.js';
import {
  imagesCommand,
  restoreEntity,
  restoreImages,
  restorePost,
  takedownCommand,
} from './switches.js';

/** The parts of a Bot API `Update` this system reads: messages only, as the webhook asks for (R-CAP-2). */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface BotDeps {
  db: Database;
  api: TelegramApi;
  /** Telegram user ids whose messages count; everyone else is ignored without a reply (R-CAP-1). */
  allowedUserIds: readonly number[];
  now?: () => Date;
  /** Where a reply that couldn't be sent is reported. The item is saved either way. */
  onReplyError?: (error: unknown) => void;
}

const captureReply = (result: CaptureResult): string => {
  switch (result.kind) {
    case 'saved':
      return `Saved #${result.id}`;
    case 'note_saved':
      return `Saved note #${result.id}`;
    case 'appended':
      return `Already saved #${result.id} (${result.status}); note added`;
    case 'follow_up':
      return `Already ${result.originalStatus} as #${result.original}; your note is #${result.id}`;
    case 'already':
      return `Already saved #${result.id} (${result.status})`;
  }
};

/** "<id> rest…", the id optionally written as #id; anything else gives no id. */
const idArgs = (args: string): { id: number | undefined; rest: string } => {
  const match = /^#?(\d{1,15})(?=\s|$)/.exec(args);
  return match?.[1] === undefined
    ? { id: undefined, rest: '' }
    : { id: Number(match[1]), rest: args.slice(match[0].length).trim() };
};

const outcomeReply = (outcome: Outcome, done: (item: ItemDetail) => string): string =>
  outcome.ok ? done(outcome.item) : outcome.message;

const loggedWarning = (id: number): string =>
  `#${id} was already logged: a post may already be on the site (/takedown removes it).`;

/** `/log <id>`, `/post <id>` (D18): the item named, so a wrong id shows, and a word if it was already logged. */
const intentReply = (outcome: IntentOutcome, intent: Intent): string => {
  if (!outcome.ok) {
    return outcome.message;
  }
  const { item, changed } = outcome;
  const what = intent === 'log' ? 'log only' : 'to post';
  const reply = `${changed ? what.charAt(0).toUpperCase() + what.slice(1) : `Already ${what}`}: ${label(item)}`;
  return changed && item.status === 'logged' ? `${reply}\n${loggedWarning(item.id)}` : reply;
};

/** After `/log <link>` (D18): what became of the item, as a suffix to the capture's reply. */
const logOnlySuffix = (outcome: IntentOutcome | undefined): string => {
  if (outcome === undefined) {
    return ` · ${LOG_ONLY}`;
  }
  if (!outcome.ok) {
    return `\n${outcome.message}`;
  }
  return outcome.changed && outcome.item.status === 'logged'
    ? ` · ${LOG_ONLY}\n${loggedWarning(outcome.item.id)}`
    : ` · ${LOG_ONLY}`;
};

/**
 * `/note`: added to an open item's note; for one already logged or discarded, a follow-up that `/news` will see, as
 * when its link comes again (R-CAP-6).
 */
const noteCommand = async (
  db: Database,
  id: number,
  text: string,
  sender: Omit<Sender, 'note'>,
): Promise<string> => {
  const item = await getItem(db, id);
  if (item && !isOpen(item.status)) {
    const followUp = await captureFollowUp(db, id, { ...sender, note: text });
    return `${label(item)} is ${item.status}; your note is #${followUp}, for /news`;
  }
  return outcomeReply(
    await addNote(db, id, text, sender.at),
    (noted) => `Noted on ${label(noted)}`,
  );
};

/** Runs a bot command (R-CAP-8) and returns the reply. */
const runCommand = async (
  command: Command,
  db: Database,
  sender: Omit<Sender, 'note'>,
): Promise<string> => {
  const { id, rest } = idArgs(command.args);
  switch (command.name) {
    case 'pending':
      return pendingList(await pendingItems(db));
    case 'discard':
      return id === undefined
        ? 'Usage: /discard <id> [reason]'
        : outcomeReply(
            await markDiscarded(db, id, rest === '' ? null : rest),
            (item) => `Discarded ${label(item)}`,
          );
    case 'restore':
      // An item's number brings it back to the inbox; `image …`, `entity …` or a post's name undoes a takedown
      // (R-CAP-11, R-CAP-12).
      if (id !== undefined && rest === '') {
        return outcomeReply(
          await restore(db, id),
          (item) => `Restored ${label(item)} (${item.status})`,
        );
      }
      if (/^image(?:\s|$)/i.test(command.args)) {
        return restoreImages(db, command.args.replace(/^image\s*/i, ''));
      }
      if (/^entity(?:\s|$)/i.test(command.args)) {
        return restoreEntity(db, command.args.replace(/^entity\s*/i, ''));
      }
      return command.args === ''
        ? 'Usage: /restore <id>, /restore <post>, /restore image <post> [lead|<source number>], or /restore entity <id>'
        : restorePost(db, command.args);
    case 'images':
      return imagesCommand(db, command.args);
    case 'takedown':
      return takedownCommand(db, command.args);
    case 'note':
      return id === undefined || rest === ''
        ? 'Usage: /note <id> <text>'
        : noteCommand(db, id, rest, sender);
    // `/log <link> [note]` never gets here: a message with links is captured (handleUpdate).
    case 'log':
      return id === undefined || rest !== ''
        ? 'Usage: /log <link> [note], or /log <id>'
        : intentReply(await setIntent(db, id, 'log'), 'log');
    case 'post':
      return id === undefined || rest !== ''
        ? 'Usage: /post <id>'
        : intentReply(await setIntent(db, id, 'post'), 'post');
    case 'help':
    case 'start':
      return HELP;
    default:
      return `I don't know /${command.name}. Send /help for the commands.`;
  }
};

/**
 * Handles one update from the webhook. Messages from anyone outside the allowlist, or outside a private chat, are
 * ignored without a reply (R-CAP-1). Each update is processed once (R-CAP-2): a capture is written in the same
 * transaction that records the update, and replies go out only after it commits.
 */
export const handleUpdate = async (update: TelegramUpdate, deps: BotDeps): Promise<void> => {
  const { message } = update;
  if (
    !message?.from ||
    message.chat.type !== 'private' ||
    !deps.allowedUserIds.includes(message.from.id)
  ) {
    return;
  }
  const reply = async (text: string): Promise<number | undefined> => {
    try {
      return await deps.api.sendMessage(message.chat.id, text, message.message_id);
    } catch (error) {
      deps.onReplyError?.(error);
      return undefined;
    }
  };

  const command = parseCommand(message);
  // `/log <link> [note]` (D18) is a capture like any message with links, the item to be logged only.
  const logCapture = command?.name === 'log' ? extractCapture(message) : undefined;
  const logOnly = logCapture !== undefined && logCapture.links.length > 0;
  if (command && !logOnly) {
    // Commands are safe to repeat: a redelivery would only reply again, so it's skipped if already processed.
    if (await wasProcessed(deps.db, update.update_id)) {
      return;
    }
    const text = await runCommand(command, deps.db, {
      submittedBy: message.from.id,
      rawText: message.text ?? '',
      at: deps.now?.() ?? new Date(),
    });
    await recordUpdate(deps.db, update.update_id);
    await reply(text);
    return;
  }

  const { links, note, rawText } = logOnly ? logCapture : extractCapture(message);
  const intent: Intent = logOnly ? 'log' : 'post';
  const sender: Sender = {
    submittedBy: message.from.id,
    rawText,
    note,
    at: deps.now?.() ?? new Date(),
  };
  if (links.length === 0 && note === '') {
    if (await recordUpdate(deps.db, update.update_id)) {
      await reply('Nothing to save: send a link or a note.');
    }
    return;
  }
  const results = await deps.db.transaction().execute(async (trx) => {
    if (!(await recordUpdate(trx, update.update_id))) {
      return [];
    }
    if (links.length === 0) {
      return [{ result: await captureNote(trx, sender), suffix: '' }];
    }
    const saved: { result: CaptureResult; suffix: string }[] = [];
    for (const link of links) {
      const result = await captureLink(trx, link, sender, intent);
      if (intent === 'post') {
        saved.push({ result, suffix: '' });
      } else if (result.kind === 'saved') {
        saved.push({ result, suffix: logOnlySuffix(undefined) });
      } else {
        // Already in the inbox: the note went where it always goes, and the item becomes log only.
        const original = result.kind === 'follow_up' ? result.original : result.id;
        saved.push({ result, suffix: logOnlySuffix(await setIntentIn(trx, original, 'log')) });
      }
    }
    return saved;
  });

  for (const { result, suffix } of results) {
    const messageId = await reply(captureReply(result) + suffix);
    if (result.kind === 'saved' && messageId !== undefined) {
      await rememberReply(deps.db, result.id, message.chat.id, messageId);
    }
  }
};
