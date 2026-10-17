import { describe, expect, it } from 'vitest';

import {
  canTransition,
  duplicateAction,
  FETCH_STATUSES,
  INBOX_STATUSES,
  type InboxStatus,
  INTENTS,
  isIntent,
  isOpen,
  restoredStatus,
} from './inbox.js';

describe('canTransition (R-DB-1)', () => {
  const allowed: Record<InboxStatus, InboxStatus[]> = {
    queued: ['queued', 'ready', 'needs_review', 'discarded'],
    ready: ['ready', 'logged', 'discarded'],
    needs_review: ['needs_review', 'logged', 'discarded'],
    logged: ['logged'],
    discarded: ['discarded', 'queued', 'ready', 'needs_review'],
  };

  for (const from of INBOX_STATUSES) {
    for (const to of INBOX_STATUSES) {
      const expected = allowed[from].includes(to);
      it(`${from} → ${to} is ${expected ? 'allowed' : 'refused'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('restoredStatus (R-DB-1)', () => {
  it('sends an item that was never fetched back to queued', () => {
    expect(restoredStatus({ hasUrl: true, fetchStatus: 'pending' })).toBe('queued');
  });

  it('sends a fetched or skipped item back to ready', () => {
    expect(restoredStatus({ hasUrl: true, fetchStatus: 'ok' })).toBe('ready');
    expect(restoredStatus({ hasUrl: true, fetchStatus: 'skipped' })).toBe('ready');
  });

  it('sends a failed fetch, or a note-only item, back to needs_review', () => {
    expect(restoredStatus({ hasUrl: true, fetchStatus: 'failed' })).toBe('needs_review');
    for (const fetchStatus of FETCH_STATUSES) {
      expect(restoredStatus({ hasUrl: false, fetchStatus })).toBe('needs_review');
    }
  });

  it('always gives a status a discarded item may move to', () => {
    for (const hasUrl of [true, false]) {
      for (const fetchStatus of FETCH_STATUSES) {
        expect(canTransition('discarded', restoredStatus({ hasUrl, fetchStatus }))).toBe(true);
      }
    }
  });
});

describe('isOpen', () => {
  it('is true until an item is logged or discarded', () => {
    expect(INBOX_STATUSES.filter(isOpen)).toEqual(['queued', 'ready', 'needs_review']);
  });
});

describe('duplicateAction (R-CAP-6)', () => {
  it('appends the note to an open item', () => {
    for (const status of ['queued', 'ready', 'needs_review'] as const) {
      expect(duplicateAction(status, 'new context')).toBe('append_note');
    }
  });

  it('creates a follow-up for a note about a logged or discarded item', () => {
    expect(duplicateAction('logged', 'now confirmed by X')).toBe('follow_up');
    expect(duplicateAction('discarded', 'actually relevant')).toBe('follow_up');
  });

  it('only replies when there is no note, whatever the status', () => {
    for (const status of INBOX_STATUSES) {
      expect(duplicateAction(status, '')).toBe('reply_only');
      expect(duplicateAction(status, '   ')).toBe('reply_only');
    }
  });
});

describe('INTENTS (D18)', () => {
  it('names what Dani wants from an item: a post and its log entry, or the log entry alone', () => {
    expect(INTENTS).toEqual(['post', 'log']);
    expect(isIntent('log')).toBe(true);
    expect(isIntent('draft')).toBe(false);
  });
});
