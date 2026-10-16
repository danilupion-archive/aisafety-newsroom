import type { InboxStatus } from '@aisafety-newsroom/domain/inbox';

import { hostOf } from '@aisafety-newsroom/domain/url';

/** The bot's replies are for Dani, so they're in English, like everything internal (aisafety-media rule 9). */

const MAX_TITLE = 80;

export interface Labelled {
  id: number;
  page_title: string | null;
  url: string | null;
}

/** "#42 · title", else "#42 · host", else "#42 · note": enough to notice a wrong id at once (R-CAP-8). */
export const label = ({ id, page_title, url }: Labelled): string => {
  const title = page_title?.replace(/\s+/g, ' ').trim();
  const name = title ? title : ((url === null ? null : hostOf(url)) ?? 'note');
  // By code points, so an emoji at the cut isn't split into half a surrogate pair, which Telegram refuses.
  const chars = Array.from(name);
  const short =
    chars.length > MAX_TITLE
      ? `${chars
          .slice(0, MAX_TITLE - 1)
          .join('')
          .trimEnd()}…`
      : name;
  return `#${id} · ${short}`;
};

/** A video's length as Dani reads it: whole minutes, at least one, and hours from the first. */
const minutes = (seconds: number): string => {
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) {
    return `${total} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/**
 * The reply once an item is fetched (R-CAP-7): its label, and for a video its length and channel (R-FET-7), so a talk
 * of two hours or the wrong channel shows at once.
 */
export const fetchedLabel = ({
  video,
  ...item
}: Labelled & {
  video: { author: string | null; durationSeconds: number | null } | undefined;
}): string => {
  if (!video) {
    return label(item);
  }
  const details = [
    'video',
    video.durationSeconds === null ? null : minutes(video.durationSeconds),
    video.author,
  ].filter((part) => part !== null);
  return `${label(item)} (${details.join(', ')})`;
};

export const pendingList = (items: (Labelled & { status: InboxStatus })[]): string =>
  items.length === 0
    ? 'Nothing pending.'
    : items.map((item) => `${label(item)} (${item.status})`).join('\n');

export const HELP = [
  'Send a link (or forward a message with links) to save it; anything else you write becomes its note.',
  'Send text without a link to save a note.',
  '',
  '/pending: what is waiting for /news',
  '/discard <id> [reason]: drop an item',
  '/restore <id>: bring a discarded item back',
  '/note <id> <text>: add to an item’s note',
  '/help: this message',
].join('\n');
