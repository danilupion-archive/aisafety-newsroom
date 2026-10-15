import { describe, expect, it } from 'vitest';

import { createTelegramApi, TelegramError } from './api.js';

const TOKEN = '123456:secret-token-that-must-not-leak';

const answer = (body: object): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** A stand-in Bot API that answers each call with the next of `answers`, and records what it was asked. */
const fakeBotApi = (answers: object[]) => {
  const calls: { method: string; body: unknown }[] = [];
  const waits: number[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method: url.split('/').at(-1) ?? '', body });
    const next = answers.shift();
    if (!next) {
      throw new Error('no answer left');
    }
    return answer(next);
  }) as typeof fetch;
  const api = createTelegramApi(TOKEN, fetchImpl, async (ms) => {
    waits.push(ms);
  });
  return { api, calls, waits };
};

const tooMany = (seconds: number) => ({
  ok: false,
  error_code: 429,
  description: `Too Many Requests: retry after ${seconds}`,
  parameters: { retry_after: seconds },
});

describe('createTelegramApi', () => {
  it('sets the webhook with its secret, for messages only', async () => {
    const { api, calls } = fakeBotApi([{ ok: true, result: true }]);
    await api.setWebhook('https://example.com/telegram/webhook', 'webhook-secret');
    expect(calls).toEqual([
      {
        method: 'setWebhook',
        body: {
          url: 'https://example.com/telegram/webhook',
          secret_token: 'webhook-secret',
          allowed_updates: ['message'],
        },
      },
    ]);
  });

  it('waits as long as a 429 asks and tries again: both replicas set the webhook as they start', async () => {
    const { api, calls, waits } = fakeBotApi([tooMany(1), { ok: true, result: true }]);
    await api.setWebhook('https://example.com/telegram/webhook', 'webhook-secret');
    expect(waits).toEqual([1000]);
    expect(calls.map((call) => call.method)).toEqual(['setWebhook', 'setWebhook']);
  });

  it('retries a reply too, and returns the message it sent', async () => {
    const { api, waits } = fakeBotApi([
      tooMany(2),
      tooMany(3),
      { ok: true, result: { message_id: 42 } },
    ]);
    await expect(api.sendMessage(7, 'Saved #1', 5)).resolves.toBe(42);
    expect(waits).toEqual([2000, 3000]);
  });

  it('gives up after a few tries, or at once when asked to wait long', async () => {
    const persistent = fakeBotApi([tooMany(1), tooMany(1), tooMany(1), tooMany(1)]);
    await expect(persistent.api.sendMessage(7, 'Saved #1')).rejects.toThrow(
      'Telegram sendMessage failed (429)',
    );
    expect(persistent.waits).toHaveLength(3);

    const long = fakeBotApi([tooMany(60)]);
    await expect(long.api.sendMessage(7, 'Saved #1')).rejects.toBeInstanceOf(TelegramError);
    expect(long.waits).toEqual([]);
  });

  it('fails on other errors without retrying, and names neither the address nor the token', async () => {
    const { api, waits } = fakeBotApi([
      { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
    ]);
    const error = await api.sendMessage(7, 'Saved #1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TelegramError);
    expect(String(error)).toContain('chat not found');
    expect(String(error)).not.toContain(TOKEN);
    expect(waits).toEqual([]);

    const unreachable = createTelegramApi(TOKEN, (async () => {
      throw new TypeError(`fetch failed for https://api.telegram.org/bot${TOKEN}/sendMessage`);
    }) as typeof fetch);
    const failed = await unreachable.sendMessage(7, 'x').catch((caught: unknown) => caught);
    expect(String(failed)).not.toContain(TOKEN);
  });

  it('treats editing a message to the same text as done', async () => {
    const { api } = fakeBotApi([
      { ok: false, error_code: 400, description: 'Bad Request: message is not modified' },
    ]);
    await expect(api.editMessageText(7, 9, 'Saved #1')).resolves.toBeUndefined();
  });
});
