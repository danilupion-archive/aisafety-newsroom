/** A browser's User-Agent (R-FET-2): many news sites refuse anything else. Configuration can replace it. */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export interface WorkerConfig {
  /** newsroom_app's connection (SPEC §7). */
  appDatabaseUrl: string;
  /** To edit the bot's "Saved #n" replies (R-CAP-7); undefined edits nothing. */
  botToken: string | undefined;
  /** Hosts never fetched (R-FET-3). */
  skipHosts: string[];
  userAgent: string;
  intervalMs: number;
  /** Q9: days a logged or discarded item keeps its page's text. */
  pageTextRetentionDays: number;
  /** For the kubelet's /healthz. */
  port: number;
}

type Env = Record<string, string | undefined>;

const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const readHosts = (value: string | undefined): string[] => {
  const hosts = (value ?? 'x.com')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
  const wrong = hosts.find((host) => !HOST.test(host));
  if (wrong !== undefined) {
    throw new Error('SKIP_FETCH_HOSTS must list host names, separated by commas');
  }
  return hosts;
};

const readNumber = (
  name: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (value === undefined || value === '') {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}`);
  }
  return number;
};

export const loadWorkerConfig = (env: Env): WorkerConfig => {
  if (!env.APP_DATABASE_URL) {
    throw new Error('APP_DATABASE_URL is required');
  }
  return {
    appDatabaseUrl: env.APP_DATABASE_URL,
    botToken: env.TELEGRAM_BOT_TOKEN || undefined,
    skipHosts: readHosts(env.SKIP_FETCH_HOSTS),
    userAgent: env.FETCH_USER_AGENT || DEFAULT_USER_AGENT,
    // R-FET-1: at least once a minute.
    intervalMs:
      readNumber('WORKER_INTERVAL_SECONDS', env.WORKER_INTERVAL_SECONDS, 30, 5, 60) * 1000,
    pageTextRetentionDays: readNumber(
      'PAGE_TEXT_RETENTION_DAYS',
      env.PAGE_TEXT_RETENTION_DAYS,
      90,
      1,
      3650,
    ),
    port: readNumber('PORT', env.PORT, 3002, 1, 65535),
  };
};
