/** One entry of an item's note: when it was added (UTC, to the minute) and what it says. */
export interface NoteEntry {
  at: string;
  text: string;
}

const ENTRY = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z)\] (.*)$/;

const stamp = (date: Date): string => `${date.toISOString().slice(0, 16).replace('T', ' ')}Z`;

/** The entries of a note, in order. Continuation lines (indented by two spaces) belong to the entry above. */
export const noteEntries = (note: string): NoteEntry[] => {
  const entries: NoteEntry[] = [];
  for (const line of note.split('\n')) {
    const match = ENTRY.exec(line);
    const last = entries.at(-1);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      entries.push({ at: match[1], text: match[2] });
    } else if (last && line.startsWith('  ')) {
      last.text = `${last.text}\n${line.slice(2)}`;
    } else if (line.trim() !== '') {
      entries.push({ at: '', text: line });
    }
  }
  return entries;
};

/**
 * The note with `text` added as a timestamped entry (SPEC §7: notes appended with timestamps). Text equal to the last
 * entry's is not added again, so a retried write changes nothing (R-API-3); blank text adds nothing.
 */
export const appendNote = (note: string, text: string, at: Date): string => {
  const trimmed = text.trim();
  if (trimmed === '' || noteEntries(note).at(-1)?.text === trimmed) {
    return note;
  }
  const entry = `[${stamp(at)}] ${trimmed.split('\n').join('\n  ')}`;
  return note === '' ? entry : `${note}\n${entry}`;
};
