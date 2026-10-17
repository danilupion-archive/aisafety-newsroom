/** What the API answered: its status and its body as text, which any number of readers can share. */
export interface Answer {
  status: number;
  body: string;
}

interface Entry {
  at: number;
  answer: Promise<Answer>;
}

/**
 * A short memory of the API's answers (R-WEB-6): each is kept for `ttlMs` from when it was asked for, and never served
 * after, so no reader sees one older than that, however long the site was quiet. Readers asking for the same thing at
 * once share one request, which is what a page and its link prefetches, or a shared post, need. A failure or a server
 * error is forgotten at once; a 404 or 410 is an answer like any other. At most `maxEntries` are held, the oldest
 * dropped first.
 */
export const createReadCache = ({
  ttlMs,
  maxEntries,
  now = Date.now,
}: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}) => {
  const entries = new Map<string, Entry>();
  const forget = (key: string, entry: Entry) => {
    if (entries.get(key) === entry) {
      entries.delete(key);
    }
  };
  return (key: string, load: () => Promise<Answer>): Promise<Answer> => {
    const hit = entries.get(key);
    if (hit && now() - hit.at < ttlMs) {
      return hit.answer;
    }
    const entry: Entry = { at: now(), answer: load() };
    entries.delete(key);
    entries.set(key, entry);
    for (const oldest of entries.keys()) {
      if (entries.size <= maxEntries) {
        break;
      }
      entries.delete(oldest);
    }
    entry.answer.then(
      (answer) => {
        if (answer.status >= 500) {
          forget(key, entry);
        }
      },
      () => forget(key, entry),
    );
    return entry.answer;
  };
};
