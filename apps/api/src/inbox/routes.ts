import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { parse } from '../parse.js';
import {
  addNote,
  getItem,
  listItems,
  markDiscarded,
  markLogged,
  type Outcome,
  restore,
} from './items.js';
import { discardedBody, itemId, listQuery, loggedBody, noteBody } from './schemas.js';

const send = (reply: FastifyReply, outcome: Outcome) => {
  if (outcome.ok) {
    return reply.send(outcome.item);
  }
  return reply.code(outcome.error === 'not_found' ? 404 : 409).send({ error: outcome.message });
};

/** The inbox API (§9), under /api/v1, behind the bearer token that app.ts checks first. */
export const inboxRoutes =
  (db: Database): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/items', async (request, reply) => {
      const query = parse(listQuery, request.query, reply);
      if (!query) {
        return reply;
      }
      return listItems(db, { statuses: query.status, limit: query.limit, sort: query.sort });
    });

    app.get<{ Params: { id: string } }>('/api/v1/items/:id', async (request, reply) => {
      const id = parse(itemId, request.params.id, reply);
      if (id === undefined) {
        return reply;
      }
      const item = await getItem(db, id);
      return item ?? reply.code(404).send({ error: `No item #${id}` });
    });

    app.post<{ Params: { id: string } }>('/api/v1/items/:id/logged', async (request, reply) => {
      const id = parse(itemId, request.params.id, reply);
      const body = id === undefined ? undefined : parse(loggedBody, request.body, reply);
      if (id === undefined || !body) {
        return reply;
      }
      return send(reply, await markLogged(db, id, body));
    });

    app.post<{ Params: { id: string } }>('/api/v1/items/:id/discarded', async (request, reply) => {
      const id = parse(itemId, request.params.id, reply);
      const body = id === undefined ? undefined : parse(discardedBody, request.body, reply);
      if (id === undefined || !body) {
        return reply;
      }
      return send(reply, await markDiscarded(db, id, body.reason));
    });

    app.post<{ Params: { id: string } }>('/api/v1/items/:id/restored', async (request, reply) => {
      const id = parse(itemId, request.params.id, reply);
      if (id === undefined) {
        return reply;
      }
      return send(reply, await restore(db, id));
    });

    app.post<{ Params: { id: string } }>('/api/v1/items/:id/note', async (request, reply) => {
      const id = parse(itemId, request.params.id, reply);
      const body = id === undefined ? undefined : parse(noteBody, request.body, reply);
      if (id === undefined || !body) {
        return reply;
      }
      return send(reply, await addNote(db, id, body.text));
    });
  };
