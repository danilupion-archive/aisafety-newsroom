import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { sql } from 'kysely';
import { z } from 'zod';

import { parse } from '../parse.js';
import { type TelegramApi, TelegramError } from '../telegram/api.js';

/** Telegram takes 4,096 characters; a little room for what a client adds. */
export const NOTIFY_MAX_LENGTH = 4000;
/** Enough for a job that reports every two hours, too few for one that runs away. */
export const NOTIFY_PER_HOUR = 30;

const notifyBody = z.strictObject({
  text: z.string().trim().min(1).max(NOTIFY_MAX_LENGTH),
});

/** Who the bot writes to: Dani's private chat with it, whose id is Dani's Telegram user id (R-CAP-1). */
export interface NotifyTarget {
  api: TelegramApi;
  chatId: number;
}

/**
 * `POST /api/v1/notify` (§9, D20): aisafety-media's word to Dani through the bot, as plain text with link previews
 * off. At most NOTIFY_PER_HOUR an hour across replicas: a transaction takes a lock that only this route uses, counts
 * the last hour's sends in app.notifications, sends, and records the send, so two requests at once can't both take
 * the last place. The text is never logged or echoed: errors name what was wrong, never what was sent.
 */
export const notifyRoutes =
  (db: Database, target: NotifyTarget | undefined): FastifyPluginAsync =>
  async (app) => {
    app.post('/api/v1/notify', async (request, reply) => {
      const body = parse(notifyBody, request.body, reply);
      if (!body) {
        return reply;
      }
      if (!target) {
        return reply
          .code(503)
          .send({ error: 'The bot isn’t configured, so there is no chat to send to' });
      }
      const outcome = await db.transaction().execute(async (trx) => {
        await sql`SELECT pg_advisory_xact_lock(hashtext('app.notifications'))`.execute(trx);
        const { sent } = await trx
          .selectFrom('app.notifications')
          .select((eb) => eb.fn.countAll<string>().as('sent'))
          .where('sent_at', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow();
        if (Number(sent) >= NOTIFY_PER_HOUR) {
          return 'limited' as const;
        }
        try {
          await target.api.sendMessage(target.chatId, body.text);
        } catch (error) {
          // Telegram's code only: its description of a refusal is about the request, never needed here.
          request.log.warn(
            { telegramCode: error instanceof TelegramError ? error.code : undefined },
            'notify: Telegram didn’t take the message',
          );
          return 'failed' as const;
        }
        await trx.insertInto('app.notifications').defaultValues().execute();
        return 'sent' as const;
      });
      if (outcome === 'limited') {
        return reply
          .code(429)
          .send({ error: `At most ${NOTIFY_PER_HOUR} messages an hour: try again later` });
      }
      if (outcome === 'failed') {
        return reply.code(502).send({ error: 'Telegram didn’t take the message' });
      }
      return { sent: true };
    });
  };
