import { describe, expect, it } from 'vitest';

import { DEFAULT_USER_AGENT, loadWorkerConfig } from './config.js';

const DATABASE = 'postgres://newsroom_app:pw@localhost:5433/newsroom';

describe('loadWorkerConfig', () => {
  it('reads the defaults: x.com skipped, a browser’s User-Agent, a round every 30 s', () => {
    expect(loadWorkerConfig({ APP_DATABASE_URL: DATABASE })).toEqual({
      appDatabaseUrl: DATABASE,
      botToken: undefined,
      skipHosts: ['x.com'],
      userAgent: DEFAULT_USER_AGENT,
      intervalMs: 30_000,
      port: 3002,
    });
  });

  it('reads the hosts to skip, the bot and the interval', () => {
    expect(
      loadWorkerConfig({
        APP_DATABASE_URL: DATABASE,
        SKIP_FETCH_HOSTS: 'x.com, Instagram.com',
        TELEGRAM_BOT_TOKEN: '123:abc',
        WORKER_INTERVAL_SECONDS: '10',
      }),
    ).toMatchObject({
      skipHosts: ['x.com', 'instagram.com'],
      botToken: '123:abc',
      intervalMs: 10_000,
    });
  });

  it('refuses what it can’t use', () => {
    expect(() => loadWorkerConfig({})).toThrow('APP_DATABASE_URL is required');
    expect(() =>
      loadWorkerConfig({ APP_DATABASE_URL: DATABASE, SKIP_FETCH_HOSTS: 'https://x.com' }),
    ).toThrow('SKIP_FETCH_HOSTS must list host names');
    // R-FET-1: at least once a minute.
    expect(() =>
      loadWorkerConfig({ APP_DATABASE_URL: DATABASE, WORKER_INTERVAL_SECONDS: '300' }),
    ).toThrow('WORKER_INTERVAL_SECONDS must be a whole number from 5 to 60');
  });
});
