export const INBOX_STATUSES = ['queued', 'ready', 'needs_review', 'logged', 'discarded'] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const FETCH_STATUSES = ['pending', 'ok', 'failed', 'skipped'] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

/**
 * What Dani wants from an item (D18): a post on the site as well as its log entry (`post`, every link's default), or
 * the log entry alone (`log`, the bot's `/log`). aisafety-media's `/news` drafts posts only for `post` (R-MED-2).
 */
export const INTENTS = ['post', 'log'] as const;
export type Intent = (typeof INTENTS)[number];

export const isIntent = (value: string): value is Intent =>
  (INTENTS as readonly string[]).includes(value);

/**
 * The moves an item may make (R-DB-1). Staying in a status is always allowed: appending a note, a fetch attempt, or
 * marking a logged item logged again with different details. The database's trigger enforces the same table.
 */
const TRANSITIONS: Record<InboxStatus, readonly InboxStatus[]> = {
  queued: ['ready', 'needs_review', 'discarded'],
  ready: ['logged', 'discarded'],
  needs_review: ['logged', 'discarded'],
  logged: [],
  discarded: ['queued', 'ready', 'needs_review'],
};

export const canTransition = (from: InboxStatus, to: InboxStatus): boolean =>
  from === to || TRANSITIONS[from].includes(to);

/** Not yet logged or discarded. */
export const isOpen = (status: InboxStatus): boolean =>
  status !== 'logged' && status !== 'discarded';

/**
 * Where a discarded item goes back to when it's restored (R-DB-1): queued if it was never fetched, ready if it was
 * fetched or skipped, needs_review if its fetch failed or it has no link.
 */
export const restoredStatus = ({
  hasUrl,
  fetchStatus,
}: {
  hasUrl: boolean;
  fetchStatus: FetchStatus;
}): InboxStatus => {
  if (!hasUrl) {
    return 'needs_review';
  }
  switch (fetchStatus) {
    case 'pending':
      return 'queued';
    case 'ok':
    case 'skipped':
      return 'ready';
    case 'failed':
      return 'needs_review';
  }
};

export type DuplicateAction = 'append_note' | 'follow_up' | 'reply_only';

/**
 * What to do when a link that's already in the inbox is sent again (R-CAP-6): append the note to an open item; turn a
 * note about a logged or discarded item into a follow-up, so it reaches `/news`; with no note, just say so.
 */
export const duplicateAction = (existing: InboxStatus, note: string): DuplicateAction => {
  if (note.trim() === '') {
    return 'reply_only';
  }
  return isOpen(existing) ? 'append_note' : 'follow_up';
};
