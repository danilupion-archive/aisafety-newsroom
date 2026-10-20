import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { parse } from '../parse.js';
import { deleteEntity, listEntities, upsertEntity } from './data.js';
import { entityAddress, entityBody } from './schemas.js';

type AddressParams = { Params: { id: string } };

/**
 * The registry's copy (D23, §13), under /api/v1 behind the bearer token that app.ts checks first: aisafety-media pushes
 * each entity before the posts that name it (R-API-6), and deletes one once none does.
 */
export const entitiesRoutes =
  (db: Database): FastifyPluginAsync =>
  async (app) => {
    app.put<AddressParams>('/api/v1/entities/:id', async (request, reply) => {
      const address = parse(entityAddress, request.params, reply);
      const body = address && parse(entityBody, request.body, reply);
      if (!address || !body) {
        return reply;
      }
      const { created, entity } = await upsertEntity(db, address.id, body);
      return reply.code(created ? 201 : 200).send(entity);
    });

    app.delete<AddressParams>('/api/v1/entities/:id', async (request, reply) => {
      const address = parse(entityAddress, request.params, reply);
      if (!address) {
        return reply;
      }
      const deletion = await deleteEntity(db, address.id);
      if (deletion === undefined) {
        return reply.code(404).send({ error: `No entity ${address.id}` });
      }
      if (deletion.kind === 'named') {
        const names = deletion.posts.map((post) => `${post.lang}/${post.slug}`).join(', ');
        return reply.code(409).send({
          error: `Entity ${address.id} is named by ${names}: push them without it first`,
          posts: deletion.posts,
        });
      }
      return { id: deletion.id, deleted_at: deletion.deleted_at };
    });

    app.get('/api/v1/entities', async () => listEntities(db));
  };
