import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { parse } from '../parse.js';
import { listPosts, unpublishPost, upsertPost } from './data.js';
import { postBody, reservedSlug, slug } from './schemas.js';

/** The posts API (§13), under /api/v1, behind the bearer token that app.ts checks first. */
export const postsRoutes =
  (db: Database): FastifyPluginAsync =>
  async (app) => {
    // An article's Markdown runs far past the API's usual 64 KB.
    app.put<{ Params: { slug: string } }>(
      '/api/v1/posts/:slug',
      { bodyLimit: 1024 * 1024 },
      async (request, reply) => {
        const name = parse(slug, request.params.slug, reply);
        const body = name === undefined ? undefined : parse(postBody, request.body, reply);
        if (name === undefined || !body) {
          return reply;
        }
        const reserved = reservedSlug(name, body.type);
        if (reserved !== undefined) {
          return reply.code(400).send({ error: reserved });
        }
        const { created, post } = await upsertPost(db, name, body);
        return reply.code(created ? 201 : 200).send(post);
      },
    );

    app.delete<{ Params: { slug: string } }>('/api/v1/posts/:slug', async (request, reply) => {
      const name = parse(slug, request.params.slug, reply);
      if (name === undefined) {
        return reply;
      }
      const unpublished = await unpublishPost(db, name);
      return unpublished ?? reply.code(404).send({ error: `No post ${name}` });
    });

    app.get('/api/v1/posts', async () => listPosts(db));
  };
