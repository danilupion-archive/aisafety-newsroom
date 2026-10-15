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
  const short = name.length > MAX_TITLE ? `${name.slice(0, MAX_TITLE - 1).trimEnd()}…` : name;
  return `#${id} · ${short}`;
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
