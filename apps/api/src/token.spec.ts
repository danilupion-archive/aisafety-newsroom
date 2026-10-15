import { describe, expect, it } from 'vitest';

import { bearerMatches, headerMatches, readApiToken, readWebhookSecret } from './token.js';

const TOKEN = 'a'.repeat(43);

describe('readApiToken (R-API-2)', () => {
  it('takes 43 printable characters or more: 256 bits as base64url', () => {
    expect(readApiToken(TOKEN)).toBe(TOKEN);
    expect(readApiToken('0123456789abcdef'.repeat(4))).toHaveLength(64);
  });

  it('refuses a missing or short token, naming the variable but never echoing it', () => {
    expect(() => readApiToken(undefined)).toThrow('API_TOKEN must have at least 43 characters');
    expect(() => readApiToken('short-secret')).toThrow(
      /^API_TOKEN must have at least 43 characters$/,
    );
  });

  it('refuses spaces and anything a header cannot carry as it is', () => {
    expect(() => readApiToken(`${TOKEN} `)).toThrow(
      'API_TOKEN must be printable ASCII with no spaces',
    );
    expect(() => readApiToken(`${TOKEN}\n`)).toThrow(
      'API_TOKEN must be printable ASCII with no spaces',
    );
    expect(() => readApiToken(`${TOKEN}ñ`)).toThrow(
      'API_TOKEN must be printable ASCII with no spaces',
    );
  });
});

describe('readWebhookSecret (R-CAP-2)', () => {
  it("takes what Telegram allows as a secret_token: 32 to 256 of A-Z, a-z, 0-9, '_' and '-'", () => {
    expect(readWebhookSecret('Ab0_-'.repeat(8))).toHaveLength(40);
    expect(() => readWebhookSecret('a'.repeat(31))).toThrow('TELEGRAM_WEBHOOK_SECRET');
    expect(() => readWebhookSecret('a'.repeat(257))).toThrow('TELEGRAM_WEBHOOK_SECRET');
    expect(() => readWebhookSecret(`${'a'.repeat(32)}!`)).toThrow('TELEGRAM_WEBHOOK_SECRET');
  });
});

describe('bearerMatches', () => {
  it('matches only the exact token as a bearer credential', () => {
    expect(bearerMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(bearerMatches(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(bearerMatches(`bearer ${TOKEN}`, TOKEN)).toBe(false);
    expect(bearerMatches(TOKEN, TOKEN)).toBe(false);
    expect(bearerMatches(undefined, TOKEN)).toBe(false);
    expect(bearerMatches([`Bearer ${TOKEN}`], TOKEN)).toBe(false);
  });
});

describe('headerMatches', () => {
  it('matches only the exact secret, given once', () => {
    expect(headerMatches(TOKEN, TOKEN)).toBe(true);
    expect(headerMatches(`${TOKEN} `, TOKEN)).toBe(false);
    expect(headerMatches(undefined, TOKEN)).toBe(false);
    expect(headerMatches([TOKEN, TOKEN], TOKEN)).toBe(false);
  });
});
