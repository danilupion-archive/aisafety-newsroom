import { createDatabase } from '@aisafety-newsroom/db/client';
import { readDsn } from '@aisafety-newsroom/observability/dsn';
import { captureException, flush } from '@sentry/node';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { initErrorTracking } from './error-tracking.js';
import { backfillImages } from './images/data.js';
import { createImageStore } from './images/store.js';
import { createTelegramApi } from './telegram/api.js';

const config = loadConfig(process.env);
initErrorTracking(readDsn(process.env), 'api');
const db = createDatabase({
  connectionString: config.appDatabaseUrl,
  applicationName: 'aisafety-newsroom-api',
});
// The site's reads run as newsroom_public, which reaches published posts only (R-WEB-6).
const publicDb = config.publicDatabaseUrl
  ? createDatabase({
      connectionString: config.publicDatabaseUrl,
      applicationName: 'aisafety-newsroom-api-public',
      // A page waits on these: a slow read fails fast and the site answers its error page.
      statementTimeoutMs: 5000,
    })
  : undefined;
const telegram = config.telegram ? createTelegramApi(config.telegram.botToken) : undefined;
// Images' files on the API's volume (D22): a folder the API can't write to stops it here, before it takes requests.
const imageStore = config.imagesDir ? createImageStore(config.imagesDir) : undefined;
await imageStore?.check();
const app = buildApp({
  apiToken: config.apiToken,
  db,
  publicDb,
  imageStore,
  bot:
    config.telegram && telegram
      ? {
          webhookSecret: config.telegram.webhookSecret,
          allowedUserIds: config.telegram.allowedUserIds,
          api: telegram,
          // The item is saved either way; only the error's message is logged (it never carries the token).
          onReplyError: (error) => {
            app.log.warn({ err: error }, 'a Telegram reply could not be sent');
            captureException(error);
          },
        }
      : undefined,
  onServerError: (error) => captureException(error),
  logger: { level: config.logLevel },
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.destroy();
  await publicDb?.destroy();
  await flush(2000);
  process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}

await app.listen({ host: config.host, port: config.port });

// Every image the database holds and the volume doesn't yet, copied in the background (D22): idempotent, so both
// replicas can do it on every start. Until it's done, a missing file is served from the database and written back.
if (imageStore) {
  backfillImages(db, imageStore).then(
    ({ checked, copied }) => app.log.info({ checked, copied }, 'image files backfilled'),
    (error: unknown) => {
      app.log.warn({ err: error }, 'image files could not be backfilled');
      captureException(error);
    },
  );
}

// Point Telegram at the webhook on every start: idempotent, so both replicas can do it. A failure leaves the webhook as
// it was, and the next start tries again.
if (config.telegram?.webhookUrl && telegram) {
  telegram.setWebhook(config.telegram.webhookUrl, config.telegram.webhookSecret).then(
    () => app.log.info('Telegram webhook registered'),
    (error: unknown) => {
      app.log.warn({ err: error }, 'the Telegram webhook could not be registered');
      captureException(error);
    },
  );
}
