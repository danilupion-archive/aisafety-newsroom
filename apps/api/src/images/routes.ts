import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyPluginAsync } from 'fastify';

import { z } from 'zod';

import { parse } from '../parse.js';
import { imageCensus, imageInfo, storeImage } from './data.js';
import { processImage, sha256Of, UPLOAD_MAX_BYTES } from './process.js';
import { type ImageStore, SHA256 } from './store.js';

export { SHA256 } from './store.js';
const address = z.strictObject({
  sha256: z
    .string()
    .regex(SHA256, 'an image is named by the SHA-256 of its bytes, in lowercase hex'),
});

/** Without a volume the API keeps no image's bytes anywhere (D22): it can't take or serve one. */
export const NO_STORE = {
  error: 'IMAGES_DIR isn’t set: this API has no volume to keep images on',
} as const;

const REFUSED = {
  unsupported: { status: 415, error: 'Not an image the site takes: JPEG, PNG, WebP or GIF' },
  unreadable: { status: 400, error: 'The image can’t be read' },
  'too-large': { status: 413, error: 'The image is too large, even re-encoded' },
} as const;

/**
 * Image uploads (§13, R-API-5), under /api/v1 behind the token like the rest. aisafety-media uploads each image a post
 * names before the post, at the address of its own SHA-256, which the API checks: the same upload twice changes
 * nothing (R-API-3), and a post can name its images before anything is stored.
 */
export const imagesRoutes =
  (db: Database, store?: ImageStore): FastifyPluginAsync =>
  async (app) => {
    // The image's bytes as they are, for this plugin's routes only.
    app.addContentTypeParser(
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'],
      { parseAs: 'buffer', bodyLimit: UPLOAD_MAX_BYTES },
      (_request, body, done) => done(null, body),
    );

    app.put<{ Params: { sha256: string } }>(
      '/api/v1/images/:sha256',
      { bodyLimit: UPLOAD_MAX_BYTES },
      async (request, reply) => {
        if (!store) {
          return reply.code(503).send(NO_STORE);
        }
        const params = parse(address, request.params, reply);
        if (!params) {
          return reply;
        }
        if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
          return reply.code(415).send({
            error: 'Send the image’s bytes, as image/jpeg, image/png, image/webp or image/gif',
          });
        }
        const actual = sha256Of(request.body);
        if (actual !== params.sha256) {
          return reply
            .code(400)
            .send({ error: `The image’s SHA-256 is ${actual}, not the one in its address` });
        }
        const existing = await imageInfo(db, params.sha256);
        const whole =
          (await store.has(params.sha256, 'full')) && (await store.has(params.sha256, 'thumb'));
        if (existing && whole) {
          return reply.code(200).send(existing);
        }
        // New, or recorded but its files lost: the same upload writes them (again).
        const processed = await processImage(request.body);
        if (typeof processed === 'string') {
          const refusal = REFUSED[processed];
          return reply.code(refusal.status).send({ error: refusal.error });
        }
        // The files first (D22): once the row exists, its files do too.
        await store.write(params.sha256, 'full', processed.full);
        await store.write(params.sha256, 'thumb', processed.thumb);
        if (existing) {
          return reply.code(200).send(existing);
        }
        const { created, image } = await storeImage(db, params.sha256, processed);
        return reply.code(created ? 201 : 200).send(image);
      },
    );

    /**
     * The images and the volume (D22): how many the database records, how many the volume has both files of, and the
     * first few it lacks, which the site can't show.
     */
    app.get('/api/v1/images', async (_request, reply) =>
      store ? imageCensus(db, store) : reply.code(503).send(NO_STORE),
    );

    app.get<{ Params: { sha256: string } }>('/api/v1/images/:sha256', async (request, reply) => {
      const params = parse(address, request.params, reply);
      if (!params) {
        return reply;
      }
      const image = await imageInfo(db, params.sha256);
      return image ?? reply.code(404).send({ error: `No image ${params.sha256}` });
    });
  };
