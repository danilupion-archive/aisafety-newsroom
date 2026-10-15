import { describe, expect, it } from 'vitest';

import { appendNote, noteEntries } from './notes.js';

const at = new Date('2026-10-15T17:42:31Z');
const later = new Date('2026-10-16T08:05:00Z');

describe('appendNote', () => {
  it('starts a note with a timestamped entry', () => {
    expect(appendNote('', 'Check the AESIA report', at)).toBe(
      '[2026-10-15 17:42Z] Check the AESIA report',
    );
  });

  it('adds each entry on its own line', () => {
    const first = appendNote('', 'one', at);
    expect(appendNote(first, 'two', later)).toBe(
      '[2026-10-15 17:42Z] one\n[2026-10-16 08:05Z] two',
    );
  });

  it("doesn't repeat the last entry, so a retried write changes nothing (R-API-3)", () => {
    const note = appendNote('', 'one', at);
    expect(appendNote(note, 'one', later)).toBe(note);
    expect(appendNote(note, '  one  ', later)).toBe(note);
  });

  it('still adds an entry that repeats an earlier one, not the last', () => {
    const note = appendNote(appendNote('', 'one', at), 'two', at);
    expect(appendNote(note, 'one', later)).toBe(`${note}\n[2026-10-16 08:05Z] one`);
  });

  it('ignores blank text', () => {
    expect(appendNote('', '   ', at)).toBe('');
  });

  it('keeps a multi-line entry together under one timestamp', () => {
    expect(appendNote('', 'line one\nline two', at)).toBe(
      '[2026-10-15 17:42Z] line one\n  line two',
    );
  });
});

describe('noteEntries', () => {
  it('reads the entries back, with their timestamps', () => {
    const note = appendNote(appendNote('', 'one', at), 'line one\nline two', later);
    expect(noteEntries(note)).toEqual([
      { at: '2026-10-15 17:42Z', text: 'one' },
      { at: '2026-10-16 08:05Z', text: 'line one\nline two' },
    ]);
  });

  it('is empty for an empty note', () => {
    expect(noteEntries('')).toEqual([]);
  });
});
