import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTelegramApi } from '../src/telegram/api.js';
import { appDatabase, asSuperuser, emptyTables } from './db.js';

const TOKEN = 'a'.repeat(43);
const SECRET = 'webhook_secret-'.repeat(3);
const DANI = 111;
const auth = { authorization: `Bearer ${TOKEN}` };
/** Distinctive, so a log line carrying it would show. */
const TEXT = 'Publicado: es/texto-de-ejemplo · https://example.com/a · https://example.org/b';

interface Call {
  method: string;
  body: Record<string, unknown>;
}

let db: Database;
let calls: Call[];
let telegramFails: boolean;
let logs: string[];
let app: FastifyInstance;
let noBot: FastifyInstance;

/** The Bot API as Telegram answers it, so the test sees the exact request the real client sends. */
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = typeof init?.body === 'string' ? init.body : '{}';
  calls.push({
    method: url.split('/').at(-1) ?? '',
    body: JSON.parse(body) as Record<string, unknown>,
  });
  const answer = telegramFails
    ? { ok: false, error_code: 400, description: 'Bad Request: chat not found' }
    : { ok: true, result: { message_id: 42 } };
  return new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const notify = (
  body: Record<string, unknown>,
  target: FastifyInstance = app,
  headers: Record<string, string> = auth,
) => target.inject({ method: 'POST', url: '/api/v1/notify', headers, payload: body });

const sentRows = async (): Promise<number> =>
  Number((await asSuperuser<{ n: string }>('SELECT count(*) AS n FROM app.notifications'))[0]?.n);

beforeAll(() => {
  db = appDatabase();
  logs = [];
  const bot = {
    webhookSecret: SECRET,
    allowedUserIds: [DANI, 222],
    api: createTelegramApi('123:fake', fakeFetch, async () => undefined),
  };
  const logger = { level: 'trace', stream: { write: (line: string) => logs.push(line) } };
  app = buildApp({ apiToken: TOKEN, db, bot, logger });
  noBot = buildApp({ apiToken: TOKEN, db, logger });
});

beforeEach(async () => {
  await emptyTables();
  calls = [];
  telegramFails = false;
});

afterAll(async () => {
  await app.close();
  await noBot.close();
  await db.destroy();
});

describe('POST /api/v1/notify', () => {
  it('sends the text to Dani’s chat as plain text with link previews off, and counts it', async () => {
    const response = await notify({ text: `  ${TEXT}  ` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
    expect(calls).toEqual([
      {
        method: 'sendMessage',
        body: { chat_id: DANI, text: TEXT, link_preview_options: { is_disabled: true } },
      },
    ]);
    expect(await sentRows()).toBe(1);
  });

  it('refuses an empty text, one over 4,000 characters, and anything but the text', async () => {
    for (const body of [
      { text: '   ' },
      { text: 'x'.repeat(4001) },
      {},
      { text: 'hola', chat: 1 },
    ]) {
      expect((await notify(body)).statusCode).toBe(400);
    }
    expect((await notify({ text: 'x'.repeat(4000) })).statusCode).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it('wants the token, like the rest of the API', async () => {
    expect((await notify({ text: TEXT }, app, {})).statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('sends at most 30 in an hour, across replicas, counting only the last hour', async () => {
    await asSuperuser(
      "INSERT INTO app.notifications (sent_at) SELECT now() - interval '2 hours' FROM generate_series(1, 30)",
    );
    expect((await notify({ text: TEXT })).statusCode).toBe(200);
    await asSuperuser(
      "INSERT INTO app.notifications (sent_at) SELECT now() - interval '10 minutes' FROM generate_series(1, 29)",
    );
    const limited = await notify({ text: TEXT });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).not.toContain(TEXT);
    expect(calls).toHaveLength(1);
  });

  it('lets only one of two requests at once take the last place', async () => {
    await asSuperuser(
      "INSERT INTO app.notifications (sent_at) SELECT now() - interval '1 minute' FROM generate_series(1, 29)",
    );
    const answers = await Promise.all([notify({ text: TEXT }), notify({ text: TEXT })]);
    expect(answers.map((answer) => answer.statusCode).sort((a, b) => a - b)).toEqual([200, 429]);
    expect(calls).toHaveLength(1);
    expect(await sentRows()).toBe(30);
  });

  it('answers 503 when there is no bot to send with', async () => {
    const response = await notify({ text: TEXT }, noBot);
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatch(/bot/i);
  });

  it('answers 502 when Telegram refuses, without the text, and counts nothing', async () => {
    telegramFails = true;
    const response = await notify({ text: TEXT });
    expect(response.statusCode).toBe(502);
    expect(JSON.stringify(response.json())).not.toContain(TEXT);
    expect(await sentRows()).toBe(0);
  });

  it('never logs the text', async () => {
    telegramFails = true;
    await notify({ text: TEXT });
    telegramFails = false;
    await notify({ text: TEXT });
    await notify({ text: `${TEXT}${'x'.repeat(4000)}` });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((line) => line.includes('texto-de-ejemplo'))).toBe(false);
  });
});
