import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { bearerMatches } from './token.js';

export interface AppOptions {
  /** The bearer token for everything under /api (R-API-1). */
  apiToken: string;
  logger?: FastifyServerOptions['logger'];
}

export const buildApp = ({ apiToken, logger = false }: AppOptions): FastifyInstance => {
  const app = Fastify({
    logger,
    // Longer than the Envoy Gateway idle timeout (60s), so the gateway closes idle connections first.
    keepAliveTimeout: 75_000,
    requestTimeout: 60_000,
  });

  // Before routing, so a caller without the token can't tell which routes exist. The token is never logged: Fastify's
  // request logs carry no headers.
  app.addHook('onRequest', async (request, reply) => {
    if (
      request.url.startsWith('/api/') &&
      !bearerMatches(request.headers.authorization, apiToken)
    ) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Liveness only: deliberately no database check, so a slow dependency never restarts the pod. Not logged: probes run
  // every few seconds.
  app.get('/healthz', { logLevel: 'silent' }, async () => ({ status: 'ok' }));

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({ error: 'Not found' }));

  return app;
};
