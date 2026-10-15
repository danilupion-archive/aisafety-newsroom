import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const TOKEN = 'a'.repeat(43);
const SECRET = 'b'.repeat(32);
const DATABASE = 'postgres://newsroom_app:pw@localhost:5433/newsroom';

const base = { API_TOKEN: TOKEN, APP_DATABASE_URL: DATABASE };

describe('loadConfig', () => {
  it('reads the defaults', () => {
    expect(loadConfig(base)).toEqual({
      host: '0.0.0.0',
      port: 3001,
      logLevel: 'info',
      apiToken: TOKEN,
      appDatabaseUrl: DATABASE,
      publicDatabaseUrl: undefined,
      telegram: undefined,
    });
  });

  it('reads the port and log level', () => {
    expect(loadConfig({ ...base, PORT: '4000', LOG_LEVEL: 'warn' })).toMatchObject({
      port: 4000,
      logLevel: 'warn',
    });
    expect(() => loadConfig({ ...base, PORT: 'eighty' })).toThrow('PORT must be a port number');
  });

  it('needs the API token and the database', () => {
    expect(() => loadConfig({ APP_DATABASE_URL: DATABASE })).toThrow('API_TOKEN');
    expect(() => loadConfig({ API_TOKEN: TOKEN })).toThrow('APP_DATABASE_URL is required');
  });

  it('reads the bot when its token, secret and allowlist are all set', () => {
    expect(
      loadConfig({
        ...base,
        TELEGRAM_BOT_TOKEN: '123456:ABC-def',
        TELEGRAM_WEBHOOK_SECRET: SECRET,
        TELEGRAM_ALLOWED_USER_IDS: '111, 222',
      }).telegram,
    ).toEqual({
      botToken: '123456:ABC-def',
      webhookSecret: SECRET,
      allowedUserIds: [111, 222],
      webhookUrl: undefined,
    });
  });

  it("reads the webhook's address, https only", () => {
    const bot = {
      ...base,
      TELEGRAM_BOT_TOKEN: '123456:ABC-def',
      TELEGRAM_WEBHOOK_SECRET: SECRET,
      TELEGRAM_ALLOWED_USER_IDS: '111',
    };
    expect(
      loadConfig({ ...bot, TELEGRAM_WEBHOOK_URL: 'https://newsroom.example/telegram/webhook' })
        .telegram?.webhookUrl,
    ).toBe('https://newsroom.example/telegram/webhook');
    expect(() =>
      loadConfig({ ...bot, TELEGRAM_WEBHOOK_URL: 'http://newsroom.example/telegram/webhook' }),
    ).toThrow('TELEGRAM_WEBHOOK_URL must be an https address');
  });

  it('refuses half a bot, so a missing secret never leaves the webhook open', () => {
    expect(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: '123456:ABC-def' })).toThrow(
      'TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and TELEGRAM_ALLOWED_USER_IDS go together',
    );
  });

  it('refuses an allowlist that is empty or not made of user ids', () => {
    const bot = { ...base, TELEGRAM_BOT_TOKEN: '123456:ABC-def', TELEGRAM_WEBHOOK_SECRET: SECRET };
    expect(() => loadConfig({ ...bot, TELEGRAM_ALLOWED_USER_IDS: ' , ' })).toThrow(
      'TELEGRAM_ALLOWED_USER_IDS must list Telegram user ids, separated by commas',
    );
    expect(() => loadConfig({ ...bot, TELEGRAM_ALLOWED_USER_IDS: '111,@dani' })).toThrow(
      'TELEGRAM_ALLOWED_USER_IDS must list Telegram user ids, separated by commas',
    );
  });
});
