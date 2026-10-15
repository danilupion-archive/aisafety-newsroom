import type { Database } from '@aisafety-newsroom/db/client';

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { TelegramApi } from './telegram/api.js';

import { inboxRoutes } from './inbox/routes.js';
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
  logger?: FastifyServerOptions['logger'];
}

/** A database error that names the constraint it broke, as pg reports it. */
const constraintOf = (error: unknown): string | undefined =>
  typeof error === 'object' &&
  error !== null &&
  'constraint' in error &&
  typeof error.constraint === 'string'
    ? error.constraint
    : undefined;

export const buildApp = ({ apiToken, db, bot, logger = false }: AppOptions): FastifyInstance => {
  const app = Fastify({
    logger,
    // Longer than the Envoy Gateway idle timeout (60s), so the gateway closes idle connections first.
    keepAliveTimeout: 75_000,
    requestTimeout: 60_000,
    bodyLimit: 64 * 1024,
  });

  // Before routing, so a caller without the token can't tell which routes exist. The token is never logged: Fastify's
  // request logs carry no headers.
  app.addHook('onRequest', async (request, reply) => {
    if (
      request.url.startsWith('/api/') &&
      !bearerMatches(request.headers.authorization, apiToken)
    ) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Liveness only: deliberately no database check, so a slow dependency never restarts the pod. Not logged: probes run
  // every few seconds.
  app.get('/healthz', { logLevel: 'silent' }, async () => ({ status: 'ok' }));

  if (db) {
    void app.register(inboxRoutes(db));
  }
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
  // the transition trigger is a conflict (R-DB-1); anything else is logged and answered without its message, which
  // could carry a query or a value.
  app.setErrorHandler(async (error: Error & { statusCode?: number }, request, reply) => {
    if (constraintOf(error) === 'inbox_items_transition') {
      return reply.code(409).send({ error: 'That item can’t make that move' });
    }
    const status = error.statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: error.message });
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'Internal error' });
  });

  return app;
};
