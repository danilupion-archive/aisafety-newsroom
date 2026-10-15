import { createHash, timingSafeEqual } from 'node:crypto';

/** 256 bits as base64url (R-API-2); `openssl rand -hex 32` gives 64 characters. */
export const MIN_API_TOKEN_LENGTH = 43;

/** What a header can carry as it is: printable ASCII, no spaces. */
const PRINTABLE = /^[\x21-\x7e]+$/u;

/** What Telegram takes as a webhook's secret_token: 1 to 256 of these. We ask for 32 at least. */
const WEBHOOK_SECRET = /^[\w-]{32,256}$/u;

/**
 * API_TOKEN, the only lock on /api/v1 (R-API-2). A stray newline or a non-ASCII character would make every request
 * fail, which would look like a server that can't be reached. Errors name the variable, never echo it.
 */
export const readApiToken = (value: string | undefined): string => {
  if (!value || value.length < MIN_API_TOKEN_LENGTH) {
    throw new Error(`API_TOKEN must have at least ${MIN_API_TOKEN_LENGTH} characters`);
  }
  if (!PRINTABLE.test(value)) {
    throw new Error('API_TOKEN must be printable ASCII with no spaces');
  }
  return value;
};

/** TELEGRAM_WEBHOOK_SECRET, which Telegram sends back on every update (R-CAP-2). */
export const readWebhookSecret = (value: string | undefined): string => {
  if (!value || !WEBHOOK_SECRET.test(value)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must be 32 to 256 of A-Z, a-z, 0-9, '_' and '-'");
  }
  return value;
};

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Whether an `Authorization` header carries the token as a bearer credential, in constant time: both sides are hashed
 * first, so neither the compare nor the lengths say how much of a guess was right.
 */
export const bearerMatches = (header: unknown, token: string): boolean => {
  const scheme = 'Bearer ';
  if (typeof header !== 'string' || !header.startsWith(scheme)) {
    return false;
  }
  return timingSafeEqual(digest(header.slice(scheme.length)), digest(token));
};

/** Whether a header carries the secret as it is, in constant time; a missing header, or several, never matches. */
export const headerMatches = (header: unknown, token: string): boolean =>
  typeof header === 'string' && timingSafeEqual(digest(header), digest(token));
