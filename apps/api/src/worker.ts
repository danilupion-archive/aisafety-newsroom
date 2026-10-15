import { createDatabase } from '@aisafety-newsroom/db/client';
import { readDsn } from '@aisafety-newsroom/observability/dsn';
import { captureMessage, flush } from '@sentry/node';
import { createServer } from 'node:http';

import { errorClass, initErrorTracking } from './error-tracking.js';
import { createTelegramApi } from './telegram/api.js';
import { loadWorkerConfig } from './worker/config.js';
import { fetchUrl } from './worker/fetch-url.js';
import { startLoop } from './worker/loop.js';
import { MAX_BYTES } from './worker/process.js';

/**
 * The worker (SPEC §8): its own Deployment, one replica, from the API's image. It claims queued items, fetches and
 * extracts them, and edits the bot's replies. Errors are logged and reported to GlitchTip (SPEC §15) by their class
 * only (errorClass): a message could carry a URL or a page's content.
 */

const config = loadWorkerConfig(process.env);
initErrorTracking(readDsn(process.env), 'worker');
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
let lastStaleReport = 0;

const loop = startLoop(
  {
    db,
    fetch: (url) =>
      fetchUrl(url, { maxBytes: MAX_BYTES, deadlineMs: 15_000, userAgent: config.userAgent }),
    skipHosts: config.skipHosts,
    telegram: config.botToken ? createTelegramApi(config.botToken) : undefined,
    onEditError: (error) => {
      log('warn', 'a Telegram reply could not be edited', { error: errorClass(error) });
      captureMessage(`a Telegram reply could not be edited: ${errorClass(error)}`, 'warning');
    },
  },
  {
    intervalMs: config.intervalMs,
    onError: (error) => {
      log('error', 'a round failed', { error: errorClass(error) });
      captureMessage(`a worker round failed: ${errorClass(error)}`, 'error');
    },
    onStale: (count) => {
      log('warn', 'items have waited in the queue for more than an hour', { count });
      // At most every half hour, so a backlog is one report, not one a round.
      if (Date.now() - lastStaleReport > 30 * 60_000) {
        lastStaleReport = Date.now();
        captureMessage(`${count} items have waited in the queue for more than an hour`, 'warning');
      }
    },
    pageText: {
      retentionDays: config.pageTextRetentionDays,
      onCleared: (count) =>
        log('info', 'cleared the page text of old items', {
          count,
          days: config.pageTextRetentionDays,
        }),
    },
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
  await flush(2000);
  process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}
