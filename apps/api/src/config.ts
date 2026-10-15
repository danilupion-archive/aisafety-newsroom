import { readApiToken, readWebhookSecret } from './token.js';

export interface TelegramConfig {
  botToken: string;
  /** Telegram sends it back on every update; anything without it is refused (R-CAP-2). */
  webhookSecret: string;
  /** Messages from anyone else are ignored without a reply (R-CAP-1). */
  allowedUserIds: number[];
  /**
   * The webhook's public address (https://newsroom.danilupion.com/telegram/webhook). When set, the API points Telegram
   * at it on every start, which is idempotent; unset, the webhook is registered by hand.
   */
  webhookUrl: string | undefined;
}

export interface ApiConfig {
  host: string;
  port: number;
  logLevel: string;
  /** The bearer token for /api/v1 (R-API-1, R-API-2). */
  apiToken: string;
  /** newsroom_app's connection (SPEC §7). Never the owner's. */
  appDatabaseUrl: string;
  /** newsroom_public's, for the site's reads (R-WEB-6); undefined, /public answers 503. */
  publicDatabaseUrl: string | undefined;
  /** The bot (SPEC §6). Undefined until it's created: the webhook then answers 503. */
  telegram: TelegramConfig | undefined;
}

type Env = Record<string, string | undefined>;

const readPort = (value: string | undefined): number => {
  if (value === undefined) {
    return 3001;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a port number');
  }
  return port;
};

const readUserIds = (value: string): number[] => {
  const ids = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (ids.length === 0 || !ids.every((id) => /^\d+$/.test(id))) {
    throw new Error('TELEGRAM_ALLOWED_USER_IDS must list Telegram user ids, separated by commas');
  }
  return ids.map(Number);
};

const readTelegram = (env: Env): TelegramConfig | undefined => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_USER_IDS } = env;
  const given = [TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_USER_IDS];
  if (given.every((value) => value === undefined)) {
    return undefined;
  }
  if (
    !TELEGRAM_BOT_TOKEN ||
    TELEGRAM_WEBHOOK_SECRET === undefined ||
    TELEGRAM_ALLOWED_USER_IDS === undefined
  ) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and TELEGRAM_ALLOWED_USER_IDS go together',
    );
  }
  return {
    botToken: TELEGRAM_BOT_TOKEN,
    webhookSecret: readWebhookSecret(TELEGRAM_WEBHOOK_SECRET),
    allowedUserIds: readUserIds(TELEGRAM_ALLOWED_USER_IDS),
    webhookUrl: readWebhookUrl(env.TELEGRAM_WEBHOOK_URL),
  };
};

const readWebhookUrl = (value: string | undefined): string | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }
  // Telegram only delivers to https.
  if (!URL.canParse(value) || new URL(value).protocol !== 'https:') {
    throw new Error('TELEGRAM_WEBHOOK_URL must be an https address');
  }
  return value;
};

export const loadConfig = (env: Env): ApiConfig => {
  if (!env.APP_DATABASE_URL) {
    throw new Error('APP_DATABASE_URL is required');
  }
  return {
    host: env.HOST ?? '0.0.0.0',
    port: readPort(env.PORT),
    logLevel: env.LOG_LEVEL ?? 'info',
    apiToken: readApiToken(env.API_TOKEN),
    appDatabaseUrl: env.APP_DATABASE_URL,
    publicDatabaseUrl: env.PUBLIC_DATABASE_URL || undefined,
    telegram: readTelegram(env),
  };
};
