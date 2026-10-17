/**
 * A search result's excerpt (R-WEB-18): Postgres marks the matched words with two control characters, which no post or
 * query can carry (the query refuses them; a post's text never reaches the reader as markup), and the API hands the
 * site plain text in segments, each matched or not. The site escapes and styles them; nothing here is HTML.
 */
export const MARK_START = '\u0002';
export const MARK_END = '\u0003';

export interface Segment {
  text: string;
  match: boolean;
}

export const segments = (marked: string): Segment[] => {
  const parts: Segment[] = [];
  let match = false;
  let text = '';
  const flush = () => {
    if (text !== '') {
      parts.push({ text, match });
    }
    text = '';
  };
  for (const character of marked) {
    if (character === MARK_START) {
      flush();
      match = true;
    } else if (character === MARK_END) {
      // An end with no start is dropped: plain text runs on.
      if (match) {
        flush();
      }
      match = false;
    } else {
      text += character;
    }
  }
  flush();
  return parts;
};
