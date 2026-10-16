import { youtubeWatchUrl } from '@aisafety-newsroom/domain/url';
import { z } from 'zod';

import type { Fetched } from './fetch-url.js';

import { capped, extract, type Extracted, oneLine } from './extract.js';

/**
 * A YouTube video (R-FET-7): its watch page carries the player's data as a JSON object assigned in a script
 * (`ytInitialPlayerResponse`), with the title, the channel, the full description and the length. It's read as data,
 * by finding where the object ends and parsing it as JSON: nothing on the page runs. A page without it, such as the
 * "confirm you're not a bot" page YouTube may show a data centre's address, gets the title and the channel from
 * YouTube's public oEmbed endpoint instead.
 */

/** The longest player data read: a real one is a few hundred kilobytes; past this, it isn't one. */
const PLAYER_MAX_CHARS = 2_000_000;

/** An oEmbed answer is a few hundred bytes. */
const OEMBED_MAX_BYTES = 64 * 1024;

/** The longest length believed: a week. Past it, or zero (a stream still on the air), the video has none. */
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

const ASSIGNMENT = /ytInitialPlayerResponse\s*=\s*/g;

/**
 * The JSON object that starts at `start`, read up to its closing brace, past braces and quotes inside its strings;
 * null when there's no object there, or it doesn't close within `max` characters.
 */
export const jsonObjectAt = (
  text: string,
  start: number,
  max = PLAYER_MAX_CHARS,
): string | null => {
  if (text[start] !== '{') {
    return null;
  }
  const end = Math.min(text.length, start + max);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < end; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return null;
};

/** A field that's kept only if it's the type expected: one odd field never loses the rest. */
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const simpleText = optional(z.object({ simpleText: optional(z.string()) }));

const PlayerSchema = z.object({
  videoDetails: optional(
    z.object({
      videoId: optional(z.string()),
      title: optional(z.string()),
      author: optional(z.string()),
      lengthSeconds: optional(z.string()),
      shortDescription: optional(z.string()),
    }),
  ),
  microformat: optional(
    z.object({
      playerMicroformatRenderer: optional(
        z.object({
          title: simpleText,
          description: simpleText,
          ownerChannelName: optional(z.string()),
          lengthSeconds: optional(z.string()),
          publishDate: optional(z.string()),
          uploadDate: optional(z.string()),
        }),
      ),
    }),
  ),
});

/** What the watch page says about the video. */
export interface PlayerVideo {
  title: string | null;
  author: string | null;
  description: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
}

const duration = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d{1,9}$/.test(value)) {
    return null;
  }
  const seconds = Number(value);
  return seconds > 0 && seconds <= MAX_DURATION_SECONDS ? seconds : null;
};

/** The first assignment of the player data whose value is a JSON object, parsed; undefined if there's none. */
const playerJson = (html: string): unknown => {
  for (const match of html.matchAll(ASSIGNMENT)) {
    const object = jsonObjectAt(html, match.index + match[0].length);
    if (object === null) {
      continue;
    }
    try {
      return JSON.parse(object) as unknown;
    } catch {
      // Not JSON after all: the next assignment, if any.
    }
  }
  return undefined;
};

/**
 * The video's details from its watch page, or null when the page holds none about this video: no player data, data
 * without the video's details (a page that asks to sign in), or about another video.
 */
export const playerData = (html: string, videoId: string): PlayerVideo | null => {
  const parsed = PlayerSchema.safeParse(playerJson(html));
  if (!parsed.success) {
    return null;
  }
  const details = parsed.data.videoDetails;
  if (details?.videoId !== videoId) {
    return null;
  }
  const micro = parsed.data.microformat?.playerMicroformatRenderer;
  const title = oneLine(details.title) ?? oneLine(micro?.title?.simpleText);
  const author = oneLine(details.author) ?? oneLine(micro?.ownerChannelName);
  if (title === null && author === null) {
    return null;
  }
  const description = details.shortDescription ?? micro?.description?.simpleText;
  return {
    title,
    author,
    description: description === undefined ? null : capped(description),
    durationSeconds: duration(details.lengthSeconds) ?? duration(micro?.lengthSeconds),
    publishedAt: oneLine(micro?.publishDate) ?? oneLine(micro?.uploadDate),
  };
};

/** YouTube's oEmbed address for a video: its title and channel, without the watch page. */
export const oembedUrl = (videoId: string): string =>
  `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`;

const OembedSchema = z.object({
  title: optional(z.string()),
  author_name: optional(z.string()),
  provider_name: optional(z.string()),
});

/** An oEmbed answer's title, channel and provider, or null for anything but a small JSON object. */
export const readOembed = (
  fetched: Fetched,
): { title: string | null; author: string | null; provider: string | null } | null => {
  if (fetched.contentType !== 'application/json' || fetched.bytes.byteLength > OEMBED_MAX_BYTES) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(fetched.bytes.toString('utf8')) as unknown;
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const parsed = OembedSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return {
    title: oneLine(parsed.data.title),
    author: oneLine(parsed.data.author_name),
    provider: oneLine(parsed.data.provider_name),
  };
};

const decode = (fetched: Fetched): string => {
  try {
    return new TextDecoder(fetched.charset ?? 'utf-8').decode(fetched.bytes);
  } catch {
    return new TextDecoder('utf-8').decode(fetched.bytes);
  }
};

/**
 * A video's record from its fetched watch page: the player data, else oEmbed's title and channel (fetched under the
 * worker's rules, R-FET-4), with the page's own metadata for what both lack. Always a video: the link is one, even when
 * neither says more than its title.
 */
export const extractVideo = async (
  fetched: Fetched,
  videoId: string,
  fetch: (url: string) => Promise<Fetched>,
): Promise<Extracted> => {
  const page = await extract('text/html', fetched.bytes, fetched.charset);
  const player = playerData(decode(fetched), videoId);
  if (player) {
    return {
      title: player.title ?? page.title,
      siteName: page.siteName,
      publishedAt: player.publishedAt ?? page.publishedAt,
      text: player.description,
      video: { author: player.author, durationSeconds: player.durationSeconds },
    };
  }
  let oembed: ReturnType<typeof readOembed> = null;
  try {
    oembed = readOembed(await fetch(oembedUrl(videoId)));
  } catch {
    // oEmbed is a fallback: without it, the page's metadata is all there is.
  }
  return {
    title: oembed?.title ?? page.title,
    siteName: page.siteName ?? oembed?.provider ?? null,
    publishedAt: page.publishedAt,
    text: null,
    video: { author: oembed?.author ?? null, durationSeconds: null },
  };
};
