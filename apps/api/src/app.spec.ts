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
