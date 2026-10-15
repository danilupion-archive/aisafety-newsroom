import { createDatabase } from '@aisafety-newsroom/db/client';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createTelegramApi } from './telegram/api.js';

const config = loadConfig(process.env);
const db = createDatabase({
  connectionString: config.appDatabaseUrl,
  applicationName: 'aisafety-newsroom-api',
});
// The site's reads run as newsroom_public, which reaches published posts only (R-WEB-6).
const publicDb = config.publicDatabaseUrl
  ? createDatabase({
      connectionString: config.publicDatabaseUrl,
      applicationName: 'aisafety-newsroom-api-public',
    })
  : undefined;
const telegram = config.telegram ? createTelegramApi(config.telegram.botToken) : undefined;
const app = buildApp({
  apiToken: config.apiToken,
  db,
  publicDb,
  bot:
    config.telegram && telegram
      ? {
          webhookSecret: config.telegram.webhookSecret,
          allowedUserIds: config.telegram.allowedUserIds,
          api: telegram,
          // The item is saved either way; only the error's message is logged (it never carries the token).
          onReplyError: (error) =>
            app.log.warn({ err: error }, 'a Telegram reply could not be sent'),
        }
      : undefined,
  logger: { level: config.logLevel },
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.destroy();
  await publicDb?.destroy();
  process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}

await app.listen({ host: config.host, port: config.port });

// Point Telegram at the webhook on every start: idempotent, so both replicas can do it. A failure leaves the webhook as
// it was, and the next start tries again.
if (config.telegram?.webhookUrl && telegram) {
  telegram.setWebhook(config.telegram.webhookUrl, config.telegram.webhookSecret).then(
    () => app.log.info('Telegram webhook registered'),
    (error: unknown) =>
      app.log.warn({ err: error }, 'the Telegram webhook could not be registered'),
  );
}
