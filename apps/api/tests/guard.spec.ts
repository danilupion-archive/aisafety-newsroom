import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';

import { connect } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { appDatabase, emptyTables, insertItem } from './db.js';

/**
 * The token guards every request the router would send to /api, however its path is written (R-API-1). Raw requests to
 * a listening server, since the test client tidies the URL before Fastify sees it.
 */
const TOKEN = 'a'.repeat(43);

let db: Database;
let app: FastifyInstance;
let port: number;

beforeAll(async () => {
  db = appDatabase();
  app = buildApp({ apiToken: TOKEN, db });
  await app.listen({ host: '127.0.0.1', port: 0 });
  port = (app.server.address() as AddressInfo).port;
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

beforeEach(async () => {
  await emptyTables();
  await insertItem({ url: 'https://example.com/a', page_title: 'Un título' });
});

/** The status line's code for a raw HTTP/1.1 request with this request target. */
const status = (target: string, method = 'GET'): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `${method} ${target} HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
      );
    });
    let data = '';
    socket.on('data', (chunk) => {
      data += chunk.toString();
    });
    socket.on('end', () => resolve(Number(/^HTTP\/1\.1 (\d{3})/.exec(data)?.[1])));
    socket.on('error', reject);
  });

describe('the token guard (R-API-1)', () => {
  it('refuses /api however the path is spelled', async () => {
    expect(await status('/api/v1/items')).toBe(401);
    expect(await status('/%61pi/v1/items')).toBe(401);
    expect(await status('/ap%69/v1/items/1')).toBe(401);
    expect(await status('/api/v1/%69tems')).toBe(401);
    expect(await status('http://x/api/v1/items')).toBe(401);
    expect(await status('http://x/%61pi/v1/items')).toBe(401);
    expect(await status('/%61pi/v1/items/1/discarded', 'POST')).toBe(401);
  });

  it('still says nothing about which /api routes exist, and leaves the rest alone', async () => {
    expect(await status('/%61pi/v1/no-such-route')).toBe(401);
    expect(await status('/healthz')).toBe(200);
    expect(await status('/no-such-page')).toBe(404);
  });
});
