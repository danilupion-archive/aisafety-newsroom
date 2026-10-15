import type { FastifyPluginAsync } from 'fastify';

import { z } from 'zod';

import { headerMatches } from '../token.js';
import { type BotDeps, handleUpdate, type TelegramUpdate } from './bot.js';

/** Just enough of an update to trust its shape; the message is read field by field where it's used. */
const update = z.looseObject({
  update_id: z.number().int().nonnegative(),
  message: z
    .looseObject({
      message_id: z.number().int(),
      chat: z.looseObject({ id: z.number().int(), type: z.string() }),
      from: z.looseObject({ id: z.number().int() }).optional(),
    })
    .optional(),
});

export interface TelegramRouteOptions {
  /** Telegram sends it back on every update; anything without it is refused (R-CAP-2). */
  webhookSecret: string;
  deps: BotDeps;
}

/**
 * The bot's webhook (SPEC §6), the API's only path besides /api/v1 on the public gateway. Without the bot configured
 * it answers 503, so Telegram keeps the updates and tries again later.
 */
export const telegramRoutes =
  (options: TelegramRouteOptions | undefined): FastifyPluginAsync =>
  async (app) => {
    app.post('/telegram/webhook', async (request, reply) => {
      if (!options) {
        return reply.code(503).send({ error: 'The bot is not configured' });
      }
      if (
        !headerMatches(request.headers['x-telegram-bot-api-secret-token'], options.webhookSecret)
      ) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const parsed = update.safeParse(request.body);
      if (!parsed.success) {
        // Not an update we can read: acknowledged, so Telegram doesn't send it again and again.
        return reply.send({});
      }
      await handleUpdate(parsed.data as TelegramUpdate, options.deps);
      return reply.send({});
    });
  };
