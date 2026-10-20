import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { unknownEntities } from '../entities/data.js';
import { missingImages } from '../images/data.js';
import { parse } from '../parse.js';
import { listPosts, unpublishPost, upsertPost } from './data.js';
import { imagesOf, postAddress, postBody, reservedSlug } from './schemas.js';

type AddressParams = { Params: { lang: string; slug: string } };

/** The posts API (§13), under /api/v1, behind the bearer token that app.ts checks first. */
export const postsRoutes =
  (db: Database): FastifyPluginAsync =>
  async (app) => {
    // An article's Markdown runs far past the API's usual 64 KB.
    app.put<AddressParams>(
      '/api/v1/posts/:lang/:slug',
      { bodyLimit: 1024 * 1024 },
      async (request, reply) => {
        const address = parse(postAddress, request.params, reply);
        const body = address && parse(postBody[address.lang], request.body, reply);
        if (!address || !body) {
          return reply;
        }
        const reserved = reservedSlug(address.lang, address.slug, body.type);
        if (reserved !== undefined) {
          return reply.code(400).send({ error: reserved });
        }
        // The images first, then the post that names them (R-API-5); and the entities (R-API-6).
        const [missing] = await missingImages(db, imagesOf(body));
        if (missing !== undefined) {
          return reply.code(400).send({
            error: `Image ${missing} isn’t uploaded: PUT /api/v1/images/${missing} first`,
          });
        }
        const [unknown, ...more] = await unknownEntities(db, body.entities);
        if (unknown !== undefined) {
          return reply.code(400).send({
            error:
              more.length === 0
                ? `Entity ${unknown} isn’t in the registry: PUT /api/v1/entities/${unknown} first`
                : `Entities ${[unknown, ...more].join(', ')} aren’t in the registry: PUT /api/v1/entities/<id> first`,
          });
        }
        const { created, post } = await upsertPost(db, address, body);
        return reply.code(created ? 201 : 200).send(post);
      },
    );

    app.delete<AddressParams>('/api/v1/posts/:lang/:slug', async (request, reply) => {
      const address = parse(postAddress, request.params, reply);
      if (!address) {
        return reply;
      }
      const unpublished = await unpublishPost(db, address);
      return (
        unpublished ?? reply.code(404).send({ error: `No post ${address.lang}/${address.slug}` })
      );
    });

    app.get('/api/v1/posts', async () => listPosts(db));
  };
