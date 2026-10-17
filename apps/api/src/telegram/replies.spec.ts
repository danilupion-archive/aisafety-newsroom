import { describe, expect, it } from 'vitest';

import { fetchedLabel, HELP, label, pendingList } from './replies.js';

describe('label', () => {
  it('names an item by its title, else its host, else as a note', () => {
    expect(label({ id: 4, page_title: 'OpenAI cuts ties', url: 'https://techcrunch.com/x' })).toBe(
      '#4 · OpenAI cuts ties',
    );
    expect(label({ id: 5, page_title: null, url: 'https://www.techcrunch.com/x' })).toBe(
      '#5 · www.techcrunch.com',
    );
    expect(label({ id: 6, page_title: null, url: null })).toBe('#6 · note');
  });

  it('shortens a long title', () => {
    const text = label({ id: 7, page_title: 'x'.repeat(200), url: null });
    expect(text.length).toBeLessThanOrEqual(90);
    expect(text.endsWith('…')).toBe(true);
  });

  it('never cuts an emoji in half', () => {
    const text = label({ id: 8, page_title: `${'x'.repeat(78)}🤖🤖 y`, url: null });
    expect(text).toBe(`#8 · ${'x'.repeat(78)}🤖…`);
    // A lone surrogate can't be encoded as UTF-8.
    expect(() => encodeURIComponent(text)).not.toThrow();
  });

  it('shows a title on one line', () => {
    expect(label({ id: 8, page_title: 'Two\nlines', url: null })).toBe('#8 · Two lines');
  });
});

describe('fetchedLabel (R-CAP-7, R-FET-7)', () => {
  const item = { id: 9, page_title: 'Una charla de ejemplo', url: 'https://youtu.be/AbCdEfGhI-_' };

  it('is the label for a page', () => {
    expect(fetchedLabel({ ...item, video: undefined })).toBe('#9 · Una charla de ejemplo');
  });

  it('adds a video’s length and channel', () => {
    expect(
      fetchedLabel({ ...item, video: { author: 'Canal de ejemplo', durationSeconds: 754 } }),
    ).toBe('#9 · Una charla de ejemplo (video, 13 min, Canal de ejemplo)');
    expect(fetchedLabel({ ...item, video: { author: null, durationSeconds: 3900 } })).toBe(
      '#9 · Una charla de ejemplo (video, 1 h 5 min)',
    );
    expect(fetchedLabel({ ...item, video: { author: null, durationSeconds: 7200 } })).toBe(
      '#9 · Una charla de ejemplo (video, 2 h)',
    );
    expect(fetchedLabel({ ...item, video: { author: null, durationSeconds: 20 } })).toBe(
      '#9 · Una charla de ejemplo (video, 1 min)',
    );
    expect(fetchedLabel({ ...item, video: { author: null, durationSeconds: null } })).toBe(
      '#9 · Una charla de ejemplo (video)',
    );
  });
});

describe('pendingList (R-CAP-8)', () => {
  it('lists each item with its status', () => {
    expect(
      pendingList([
        { id: 1, status: 'queued', page_title: null, url: 'https://example.com/a' },
        { id: 2, status: 'ready', page_title: 'A title', url: 'https://example.com/b' },
      ]),
    ).toBe('#1 · example.com (queued)\n#2 · A title (ready)');
  });

  it('says so when nothing is pending', () => {
    expect(pendingList([])).toBe('Nothing pending.');
  });
});

describe('HELP', () => {
  it('lists every command', () => {
    for (const command of [
      '/pending',
      '/discard',
      '/restore',
      '/note',
      '/images',
      '/takedown',
      '/help',
    ]) {
      expect(HELP).toContain(command);
    }
  });
});
