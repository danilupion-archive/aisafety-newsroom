import { createDatabase } from '@aisafety-newsroom/db/client';
import { createServer } from 'node:http';

import { createTelegramApi } from './telegram/api.js';
import { loadWorkerConfig } from './worker/config.js';
import { fetchUrl } from './worker/fetch-url.js';
import { startLoop } from './worker/loop.js';
import { MAX_BYTES } from './worker/process.js';

/**
 * The worker (SPEC §8): its own Deployment, one replica, from the API's image. It claims queued items, fetches and
 * extracts them, and edits the bot's replies. Errors are logged by their class only: a message could carry a URL or a
 * page's content.
 */

const config = loadWorkerConfig(process.env);
const db = createDatabase({
  connectionString: config.appDatabaseUrl,
  maxConnections: 4,
  applicationName: 'aisafety-newsroom-worker',
});

const log = (
  level: 'info' | 'warn' | 'error',
  msg: string,
  extra: Record<string, unknown> = {},
): void => {
  console[level === 'info' ? 'log' : level](
    JSON.stringify({ level, time: Date.now(), msg, ...extra }),
  );
};
const errorClass = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? {
        error: error.name,
        ...('code' in error && typeof error.code === 'string' ? { code: error.code } : {}),
      }
    : { error: typeof error };

const loop = startLoop(
  {
    db,
    fetch: (url) =>
      fetchUrl(url, { maxBytes: MAX_BYTES, deadlineMs: 15_000, userAgent: config.userAgent }),
    skipHosts: config.skipHosts,
    telegram: config.botToken ? createTelegramApi(config.botToken) : undefined,
    onEditError: (error) => log('warn', 'a Telegram reply could not be edited', errorClass(error)),
  },
  {
    intervalMs: config.intervalMs,
    onError: (error) => log('error', 'a round failed', errorClass(error)),
    onStale: (count) =>
      log('warn', 'items have waited in the queue for more than an hour', { count }),
  },
);

// Liveness only, for the kubelet: no dependency is checked.
const health = createServer((request, response) => {
  const ok = request.method === 'GET' && request.url === '/healthz';
  response.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' });
  response.end(ok ? '{"status":"ok"}' : '{"error":"Not found"}');
});
health.listen(config.port, () =>
  log('info', 'worker started', { port: config.port, skipHosts: config.skipHosts }),
);

const shutdown = async (): Promise<void> => {
  await loop.stop();
  health.close();
  await db.destroy();
  process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}
