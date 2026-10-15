import { addBreadcrumb, captureMessage, close, createTransport, flush } from '@sentry/node';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initErrorTracking } from './error-tracking.js';

/**
 * The real SDK with our options, against a local server: what leaves the process with an outgoing request, and what
 * an event carries afterwards. The bot's token is in every Bot API path (telegram/api.ts), and the worker fetches pages
 * Dani saved (R-FET-4: nothing of ours goes with them).
 */
const TOKEN = '123456:AAsecret-bot-token';
const received: Record<string, string | string[] | undefined>[] = [];
const envelopes: string[] = [];
const server = createServer((request, response) => {
  received.push(request.headers);
  response.writeHead(400, { 'content-type': 'application/json' });
  response.end('{"ok":false}');
});
let origin = '';

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  initErrorTracking(
    {
      value: 'http://publickey@127.0.0.1:9/1',
      publicKey: 'publickey',
      projectId: '1',
      envelopeUrl: 'http://127.0.0.1:9/api/1/envelope/',
    },
    'worker',
    {
      transport: (options) =>
        createTransport(options, async (request) => {
          envelopes.push(
            typeof request.body === 'string'
              ? request.body
              : new TextDecoder().decode(request.body),
          );
          return { statusCode: 200 };
        }),
    },
  );
});

afterAll(async () => {
  await close();
  server.close();
});

describe('error tracking with the real SDK', () => {
  it('adds no trace headers to outgoing requests, and keeps no token or page path in breadcrumbs', async () => {
    // As the bot calls Telegram (fetch) and as the worker fetches a page (node:http).
    await fetch(`${origin}/bot${TOKEN}/sendMessage`, { method: 'POST', body: '{}' });
    await new Promise<void>((resolve, reject) => {
      httpRequest(`${origin}/a/saved/page?utm_source=x`, (response) => {
        response.resume();
        response.on('end', resolve);
      })
        .on('error', reject)
        .end();
    });
    addBreadcrumb({ category: 'http', data: { url: `${origin}/bot${TOKEN}/editMessageText` } });
    captureMessage('a worker round failed: TypeError', 'error');
    await flush(2000);

    expect(received).toHaveLength(2);
    for (const headers of received) {
      expect(headers['sentry-trace']).toBeUndefined();
      expect(headers.baggage).toBeUndefined();
      expect(headers.traceparent).toBeUndefined();
    }
    const sent = envelopes.join('\n');
    expect(sent).toContain('a worker round failed');
    expect(sent).not.toContain('secret-bot-token');
    expect(sent).not.toContain('/a/saved/page');
    expect(sent).not.toContain('utm_source');
  });
});
