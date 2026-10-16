import type { Database } from '@aisafety-newsroom/db/client';

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { TelegramApi } from './telegram/api.js';

import { inboxRoutes } from './inbox/routes.js';
import { postsRoutes } from './posts/routes.js';
import { publicRoutes } from './public/routes.js';
import { telegramRoutes } from './telegram/routes.js';
import { bearerMatches } from './token.js';

export interface BotOptions {
  webhookSecret: string;
  allowedUserIds: readonly number[];
  api: TelegramApi;
  onReplyError?: (error: unknown) => void;
}

export interface AppOptions {
  /** The bearer token for everything under /api (R-API-1). */
  apiToken: string;
  /** newsroom_app's connection (SPEC §7). Without it, only /healthz answers: tests of the guard need nothing else. */
  db?: Database;
  /** The bot (SPEC §6), which needs the database. Without it, the webhook answers 503. */
  bot?: BotOptions;
  /** newsroom_public's connection, for the site's reads (R-WEB-6). Without it, /public answers 503. */
  publicDb?: Database;
  /** Told of every 5xx, to report it (SPEC §15); the client gets no message either way. */
  onServerError?: (error: Error) => void;
  logger?: FastifyServerOptions['logger'];
}

/**
 * The path the router sees: without an absolute-form request's scheme and host, without the query, percent-decoded.
 * find-my-way routes `/%61pi/v1/items` and `GET http://x/api/v1/items` to /api/v1/items, so the guard must read the
 * path the same way, not as it was written.
 */
export const routedPath = (url: string): string => {
  const path = url.replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i, '').split('?', 1)[0] ?? '';
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** A database error that names the constraint it broke, as pg reports it. */
const constraintOf = (error: unknown): string | undefined =>
  typeof error === 'object' &&
  error !== null &&
  'constraint' in error &&
  typeof error.constraint === 'string'
    ? error.constraint
    : undefined;

/** The database's rules a request can break, as conflicts (409) that say which rule: R-DB-1, R-WEB-10. */
const CONFLICTS: Readonly<Record<string, string>> = {
  inbox_items_transition: 'That item can’t make that move',
  posts_translation_of_fkey: 'The post it translates hasn’t been pushed: push that one first',
  posts_one_translation_per_lang: 'That post already has a translation in this language',
  posts_translation_of_original: 'That post is a translation itself: translate its original',
  posts_translated_is_original: 'This post has translations, so it can’t be a translation itself',
  posts_page_has_no_news_date: 'A page has no news date',
};

export const buildApp = ({
  apiToken,
  db,
  bot,
  publicDb,
  onServerError,
  logger = false,
}: AppOptions): FastifyInstance => {
  const app = Fastify({
    logger,
    // Longer than the Envoy Gateway idle timeout (60s), so the gateway closes idle connections first.
    keepAliveTimeout: 75_000,
    requestTimeout: 60_000,
    bodyLimit: 64 * 1024,
  });

  // Every request routed to /api, and every one whose path reads as /api, so a caller without the token can't tell
  // which routes exist. The token is never logged: Fastify's request logs carry no headers.
  app.addHook('onRequest', async (request, reply) => {
    const guarded =
      request.routeOptions.url?.startsWith('/api/') === true ||
      routedPath(request.url).startsWith('/api/');
    if (guarded && !bearerMatches(request.headers.authorization, apiToken)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Liveness only: deliberately no database check, so a slow dependency never restarts the pod. Not logged: probes run
  // every few seconds.
  app.get('/healthz', { logLevel: 'silent' }, async () => ({ status: 'ok' }));

  if (db) {
    void app.register(inboxRoutes(db));
    void app.register(postsRoutes(db));
  }
  void app.register(publicRoutes(publicDb));
  void app.register(
    telegramRoutes(
      db && bot
        ? {
            webhookSecret: bot.webhookSecret,
            deps: {
              db,
              api: bot.api,
              allowedUserIds: bot.allowedUserIds,
              onReplyError: bot.onReplyError,
            },
          }
        : undefined,
    ),
  );

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({ error: 'Not found' }));

  // Every error in the API's shape (§9). Client errors keep Fastify's message (a body that isn't JSON, one too large);
  // a database rule the request broke is a conflict (CONFLICTS); anything else is logged and answered without its
  // message, which could carry a query or a value.
  app.setErrorHandler(async (error: Error & { statusCode?: number }, request, reply) => {
    const conflict = CONFLICTS[constraintOf(error) ?? ''];
    if (conflict !== undefined) {
      return reply.code(409).send({ error: conflict });
    }
    const status = error.statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: error.message });
    }
    request.log.error({ err: error }, 'request failed');
    onServerError?.(error);
    return reply.code(500).send({ error: 'Internal error' });
  });

  return app;
};
