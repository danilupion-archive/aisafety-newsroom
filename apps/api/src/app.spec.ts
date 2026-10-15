import { afterAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const TOKEN = 'a'.repeat(43);
const app = buildApp({ apiToken: TOKEN });

afterAll(async () => {
  await app.close();
});

describe('the API', () => {
  it('answers /healthz without the token, with no dependency checked', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('refuses anything under /api without the token, before saying whether it exists (R-API-1)', async () => {
    for (const url of ['/api/v1/items', '/api/v1/no-such-route', '/api/anything']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    }
  });

  it('refuses a wrong token, and the token sent any way but as a bearer header', async () => {
    for (const headers of [
      { authorization: `Bearer ${TOKEN}x` },
      { authorization: TOKEN },
      { 'x-api-token': TOKEN },
    ]) {
      const response = await app.inject({ method: 'GET', url: '/api/v1/items', headers });
      expect(response.statusCode).toBe(401);
    }
  });

  it('answers 404 in the API shape once the token is right', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/no-such-route',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Not found' });
  });
});

describe('errors', () => {
  const reported: Error[] = [];
  const failing = buildApp({ apiToken: TOKEN, onServerError: (error) => reported.push(error) });
  const headers = { authorization: `Bearer ${TOKEN}` };
  failing.get('/api/v1/refused-move', async () => {
    throw Object.assign(new Error('item 7 can’t move from logged to ready'), {
      code: '23514',
      constraint: 'inbox_items_transition',
    });
  });
  failing.get('/api/v1/broken', async () => {
    throw new Error('connection to postgres://user:secret@host failed');
  });
  failing.post('/api/v1/echo', async (request) => request.body);

  afterAll(async () => {
    await failing.close();
  });

  it('answers a move the transition trigger refused with 409 (R-DB-1)', async () => {
    const response = await failing.inject({ method: 'GET', url: '/api/v1/refused-move', headers });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'That item can’t make that move' });
  });

  it('answers an unexpected error with 500 and never its message', async () => {
    const response = await failing.inject({ method: 'GET', url: '/api/v1/broken', headers });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Internal error' });
    // Reported for error tracking (SPEC §15); a 409 or a 400 is not.
    expect(reported.map((error) => error.message)).toEqual([
      'connection to postgres://user:secret@host failed',
    ]);
  });

  it('answers a body that is not JSON with 400, in the API shape', async () => {
    const response = await failing.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: expect.any(String) });
  });
});
