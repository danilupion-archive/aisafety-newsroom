import { describe, expect, it } from 'vitest';

import { MARK_END, MARK_START, segments } from './excerpt.js';

describe('segments (R-WEB-18)', () => {
  it('splits a marked excerpt into plain text and matched words', () => {
    expect(
      segments(`la ${MARK_START}regulación${MARK_END} llega ${MARK_START}ya${MARK_END}`),
    ).toEqual([
      { text: 'la ', match: false },
      { text: 'regulación', match: true },
      { text: ' llega ', match: false },
      { text: 'ya', match: true },
    ]);
  });

  it('keeps an excerpt with no match as one plain segment, and drops empty ones', () => {
    expect(segments('nada que marcar')).toEqual([{ text: 'nada que marcar', match: false }]);
    expect(segments(`${MARK_START}todo${MARK_END}`)).toEqual([{ text: 'todo', match: true }]);
    expect(segments('')).toEqual([]);
  });

  it('never lets a stray mark through, nor treats one as a match', () => {
    expect(segments(`a${MARK_END}b${MARK_START}c`)).toEqual([
      { text: 'ab', match: false },
      { text: 'c', match: true },
    ]);
  });
});
