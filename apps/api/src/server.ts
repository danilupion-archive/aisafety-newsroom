import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = buildApp({ apiToken: config.apiToken, logger: { level: config.logLevel } });

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}

await app.listen({ host: config.host, port: config.port });
