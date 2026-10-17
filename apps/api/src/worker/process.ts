import type { Database } from '@aisafety-newsroom/db/client';

import { hostOf, youtubeVideoId, youtubeWatchUrl } from '@aisafety-newsroom/domain/url';

import type { TelegramApi } from '../telegram/api.js';

import { fetchedLabel, LOG_ONLY } from '../telegram/replies.js';
import { extract } from './extract.js';
import { type Fetched, FetchRefused, pageType } from './fetch-url.js';
import {
  type Claimed,
  markSkipped,
  MAX_ATTEMPTS,
  type ReplyTarget,
  type Saved,
  saveFailure,
  saveFetched,
} from './jobs.js';
import { extractVideo } from './youtube.js';
/** HTML past this is refused even though PDFs may be larger (R-FET-2: HTML up to 5 MB, PDFs up to 30 MB). */
export const HTML_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_BYTES = 30 * 1024 * 1024;

/** Minutes before the next attempt, after the nth failed one. */
const RETRY_IN_MINUTES = [1, 10];

export interface WorkerDeps {
  db: Database;
  /** Fetches a link under R-FET-4's rules (fetch-url.ts); a test gives its own. */
  fetch: (url: string) => Promise<Fetched>;
  /** Hosts never fetched, starting with x.com and axios.com (R-FET-3); their subdomains too. */
  skipHosts: readonly string[];
  /** To edit the "Saved #n" reply once the item is fetched (R-CAP-7); without it, nothing is edited. */
  telegram?: TelegramApi;
  /** Where an edit that failed is reported. The item is stored either way. */
  onEditError?: (error: unknown) => void;
}

export const isSkipped = (host: string, skipHosts: readonly string[]): boolean =>
  skipHosts.some((skipped) => host === skipped || host.endsWith(`.${skipped}`));

/** What went wrong, short enough for `last_error` and for the reply: never a URL, a header or a page's content. */
const describe = (error: unknown): { reason: string; final: boolean } => {
  if (error instanceof FetchRefused) {
    if (error.reason === 'status') {
      // A page that's gone won't come back with another try.
      return {
        reason: `HTTP ${error.status}`,
        final: error.status === 404 || error.status === 410,
      };
    }
    // A link that isn't http(s), or that points off the public internet, is refused the same way every time.
    return { reason: error.reason, final: error.reason === 'scheme' || error.reason === 'address' };
  }
  // Extraction failed: its class only, since a message could quote the document.
  return { reason: `unreadable (${error instanceof Error ? error.name : 'error'})`, final: false };
};

/** Edits the item's "Saved #n" reply, if it was stored and its reply is known (R-CAP-7). */
export const editReply = async (
  reply: ReplyTarget | null | undefined,
  text: string,
  deps: WorkerDeps,
): Promise<void> => {
  if (!deps.telegram || !reply) {
    return;
  }
  try {
    await deps.telegram.editMessageText(reply.chatId, reply.messageId, text);
  } catch (error) {
    deps.onEditError?.(error);
  }
};

/** A reply as edited: an item Dani wants logged only keeps saying so (D18), as its "Saved #n" reply did. */
export const replyText = (text: string, logOnly: boolean | undefined): string =>
  logOnly ? `${text} · ${LOG_ONLY}` : text;

/** The reply for an item the worker gave up on. */
export const failedReply = (id: number, reason: string): string =>
  `#${id} · couldn't fetch it (${reason}); your note goes to /news`;

const replyOf = (stored: Saved): ReplyTarget | null | undefined => stored?.reply;

/** Fetches one claimed item and records what came of it: ready, skipped, a retry, or needs_review. */
export const processItem = async (item: Claimed, deps: WorkerDeps): Promise<void> => {
  const host = hostOf(item.url);
  if (host !== null && isSkipped(host, deps.skipHosts)) {
    const stored = await markSkipped(deps.db, item.id);
    await editReply(
      replyOf(stored),
      replyText(`#${item.id} · ${host} (not fetched; your note goes to /news)`, stored?.logOnly),
      deps,
    );
    return;
  }

  // A YouTube video is read from its watch page, whichever form of link was sent (R-FET-7).
  const video = youtubeVideoId(item.url);
  try {
    const fetched = await deps.fetch(video ? youtubeWatchUrl(video) : item.url);
    const type = pageType(fetched.contentType, fetched.bytes);
    if (type === 'text/html' && fetched.bytes.byteLength > HTML_MAX_BYTES) {
      throw new FetchRefused('tooLarge');
    }
    const extracted =
      video && type === 'text/html'
        ? await extractVideo(fetched, video, deps.fetch)
        : await extract(type, fetched.bytes, fetched.charset);
    const stored = await saveFetched(deps.db, item.id, {
      status: fetched.status,
      finalUrl: fetched.finalUrl,
      contentType: type,
      extracted,
    });
    await editReply(
      replyOf(stored),
      replyText(
        fetchedLabel({
          id: item.id,
          page_title: extracted.title,
          url: item.url,
          video: extracted.video,
        }),
        stored?.logOnly,
      ),
      deps,
    );
  } catch (error) {
    const { reason, final } = describe(error);
    const lastTry = final || item.attempts >= MAX_ATTEMPTS;
    const retryIn = lastTry ? undefined : RETRY_IN_MINUTES[item.attempts - 1];
    const stored = await saveFailure(deps.db, item.id, reason, retryIn);
    if (lastTry) {
      await editReply(
        replyOf(stored),
        replyText(failedReply(item.id, reason), stored?.logOnly),
        deps,
      );
    }
  }
};
