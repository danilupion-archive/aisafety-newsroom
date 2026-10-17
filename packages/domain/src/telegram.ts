import { normalizeUrl, withScheme } from './url.js';

/** The parts of a Telegram entity this system reads. Offsets and lengths are in UTF-16 code units. */
export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  /** For `text_link` entities: the link behind the visible text. */
  url?: string;
}

/** The parts of a Telegram message this system reads (Bot API `Message`). */
export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
  entities?: TelegramEntity[];
  caption?: string;
  caption_entities?: TelegramEntity[];
  /** Set on forwarded messages; their text and entities are read the same way. */
  forward_origin?: { type: string };
}

export interface CapturedLink {
  /** The link as sent, with `https://` in front if it had no scheme ("example.com/a"): what the worker fetches. */
  url: string;
  normalized: string;
}

export interface Capture {
  /** One per distinct link, in the order they appear (R-CAP-3). */
  links: CapturedLink[];
  /** The text without the links' own text. Empty if nothing else was said. */
  note: string;
  rawText: string;
}

/**
 * Longer links aren't captured as links: they stay in the note. The unique index on the normalised link can't hold a
 * row much past 2.7 KB, and an insert that fails every time would leave Telegram redelivering the message for a day,
 * then dropping it with no reply.
 */
export const MAX_URL_LENGTH = 2048;

const tidy = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * The links and the note in a message or its caption (R-CAP-3), forwarded or not. A `url` entity's text is the link
 * and leaves the note; a `text_link` keeps its visible text in the note. A link that isn't http or https, or is longer
 * than MAX_URL_LENGTH, stays in the note. A command the message starts with leaves it too (`/log`, D18).
 */
export const extractCapture = (message: TelegramMessage): Capture => {
  const rawText = message.text ?? message.caption ?? '';
  const entities = (message.text === undefined ? message.caption_entities : message.entities) ?? [];

  const found: { url: string; normalized: string; entity: TelegramEntity }[] = [];
  for (const entity of [...entities].sort((a, b) => a.offset - b.offset)) {
    const url =
      entity.type === 'url'
        ? rawText.slice(entity.offset, entity.offset + entity.length)
        : entity.type === 'text_link'
          ? entity.url
          : undefined;
    const normalized = url === undefined ? null : normalizeUrl(url);
    if (url !== undefined && normalized !== null && normalized.length <= MAX_URL_LENGTH) {
      found.push({ url: withScheme(url), normalized, entity });
    }
  }

  // From the end, so the offsets still to remove stay valid.
  let note = rawText;
  for (const { entity } of [...found].reverse()) {
    if (entity.type === 'url') {
      note = note.slice(0, entity.offset) + note.slice(entity.offset + entity.length);
    }
  }
  // A command the message starts with (`/log <link> [note]`, D18) isn't part of the note.
  const command = entities.find((entity) => entity.type === 'bot_command' && entity.offset === 0);
  if (command) {
    note = note.slice(command.length);
  }

  const seen = new Set<string>();
  const links: CapturedLink[] = [];
  for (const { url, normalized } of found) {
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push({ url, normalized });
    }
  }

  return { links, note: tidy(note), rawText };
};

export interface Command {
  /** Lowercase, without the slash or the bot's name. */
  name: string;
  args: string;
}

/** The bot command a message starts with (R-CAP-8), or null if it doesn't start with one. */
export const parseCommand = (message: TelegramMessage): Command | null => {
  const text = message.text ?? '';
  const entity = message.entities?.find(
    (candidate) => candidate.type === 'bot_command' && candidate.offset === 0,
  );
  if (!entity) {
    return null;
  }
  const [name = ''] = text.slice(1, entity.length).split('@');
  return { name: name.toLowerCase(), args: text.slice(entity.length).trim() };
};
