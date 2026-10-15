import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { appDatabase, emptyTables, publicDatabase } from './db.js';

const TOKEN = 'a'.repeat(43);
const auth = { authorization: `Bearer ${TOKEN}` };

/** About 100 words of obviously fictional Spanish, as a breve's body. */
const BODY = Array.from(
  { length: 10 },
  (_, i) => `Frase de ejemplo número ${i + 1} sobre un laboratorio ficticio y su informe.`,
).join(' ');

const BREVE = {
  type: 'breve',
  title: 'Un laboratorio ficticio publica su informe',
  summary: 'Resumen de ejemplo.',
  body_md: BODY,
  sources: [
    { title: 'Informe de ejemplo', url: 'https://example.com/informe', accessed: '2026-10-15' },
  ],
  tags: ['labs', 'evals'],
  published_at: '2026-10-15T10:00:00+02:00',
  content_ref: { path: 'posts/2026-10-15-informe-de-ejemplo.md', commit: 'abc1234' },
};

let db: Database;
let publicDb: Database;
let app: FastifyInstance;

beforeAll(() => {
  db = appDatabase();
  publicDb = publicDatabase();
  app = buildApp({ apiToken: TOKEN, db, publicDb });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await publicDb.destroy();
});

beforeEach(async () => {
  await emptyTables();
});

const put = (slug: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/api/v1/posts/${slug}`, headers: auth, payload });
const remove = (slug: string) =>
  app.inject({ method: 'DELETE', url: `/api/v1/posts/${slug}`, headers: auth });
const read = (url: string) => app.inject({ method: 'GET', url });

describe('PUT /api/v1/posts/:slug (§13)', () => {
  it('creates a post (201), then replaces it (200), the same push giving the same post', async () => {
    const created = await put('informe-de-ejemplo', BREVE);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      slug: 'informe-de-ejemplo',
      type: 'breve',
      tags: ['labs', 'evals'],
    });

    const again = await put('informe-de-ejemplo', BREVE);
    expect(again.statusCode).toBe(200);
    const edited = await put('informe-de-ejemplo', { ...BREVE, title: 'Un título corregido' });
    expect(edited.json()).toMatchObject({ title: 'Un título corregido' });
  });

  it('holds a breve to 80–150 words and 1–3 sources (R-WEB-1)', async () => {
    const short = await put('corta', { ...BREVE, body_md: 'Demasiado corta.' });
    expect(short.statusCode).toBe(400);
    expect(short.json()).toEqual({ error: 'body_md: a breve is 80–150 words; this one has 2' });

    const source = BREVE.sources[0];
    expect(
      (await put('muchas-fuentes', { ...BREVE, sources: [source, source, source, source] })).json(),
    ).toEqual({
      error: 'sources: a breve has 1–3 sources',
    });
    expect((await put('sin-fuentes', { ...BREVE, sources: [] })).statusCode).toBe(400);
  });

  it('lets an article run long, but still with its sources', async () => {
    const article = { ...BREVE, type: 'article', body_md: `${BODY}\n\n`.repeat(20) };
    expect((await put('un-articulo', article)).statusCode).toBe(201);
    expect((await put('otro-articulo', { ...article, sources: [] })).statusCode).toBe(400);
  });

  it('refuses a bad slug, a source that isn’t a web address, and anything but its own fields', async () => {
    expect((await put('Con-Mayusculas', BREVE)).statusCode).toBe(400);
    const javascript = { ...BREVE, sources: [{ ...BREVE.sources[0], url: 'javascript:alert(1)' }] };
    expect((await put('fuente-rara', javascript)).statusCode).toBe(400);
    expect((await put('campo-de-mas', { ...BREVE, html: '<b>no</b>' })).statusCode).toBe(400);
  });

  it('needs the token', async () => {
    const response = await app.inject({ method: 'PUT', url: '/api/v1/posts/x', payload: BREVE });
    expect(response.statusCode).toBe(401);
  });
});

describe('pages', () => {
  it('takes the site’s own pages without sources, readable by slug but never listed', async () => {
    const about = {
      ...BREVE,
      type: 'page',
      title: 'Sobre este sitio',
      body_md: 'Texto de ejemplo.',
      sources: [],
    };
    expect((await put('sobre', about)).statusCode).toBe(201);
    expect((await read('/public/posts/sobre')).json()).toMatchObject({
      type: 'page',
      title: 'Sobre este sitio',
    });
    expect((await read('/public/posts')).json()).toEqual([]);
    expect((await read('/public/tags')).json()).toEqual([]);
  });
});

describe('reserved slugs', () => {
  it('refuses the site’s own paths, but takes the about page as sobre', async () => {
    expect((await put('temas', BREVE)).json()).toEqual({
      error: "temas is one of the site's own paths",
    });
    expect((await put('sobre', BREVE)).statusCode).toBe(400);
    const about = { ...BREVE, type: 'page', body_md: 'Texto de ejemplo.', sources: [] };
    expect((await put('sobre', about)).statusCode).toBe(201);
  });
});

describe('DELETE /api/v1/posts/:slug (AC-7)', () => {
  it('unpublishes a post: its page answers 410 and it leaves the lists; pushing it again restores it', async () => {
    await put('informe-de-ejemplo', BREVE);
    const deleted = await remove('informe-de-ejemplo');
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ slug: 'informe-de-ejemplo' });

    expect((await read('/public/posts/informe-de-ejemplo')).statusCode).toBe(410);
    expect((await read('/public/unpublished')).json()).toEqual(['informe-de-ejemplo']);
    expect((await read('/public/posts')).json()).toEqual([]);
    expect((await remove('informe-de-ejemplo')).statusCode).toBe(200);

    await put('informe-de-ejemplo', BREVE);
    expect((await read('/public/posts/informe-de-ejemplo')).statusCode).toBe(200);
  });

  it('answers 404 for a post that never was', async () => {
    expect((await remove('no-existe')).statusCode).toBe(404);
  });
});

describe('GET /api/v1/posts', () => {
  it('lists every post for aisafety-media to reconcile, unpublished ones and their origin included (R-WEB-8)', async () => {
    await put('primera', BREVE);
    await put('segunda', { ...BREVE, published_at: '2026-10-16' });
    await remove('primera');
    const posts = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      { slug: string; unpublished_at: string | null; content_ref: unknown }[]
    >();
    expect(posts.map((post) => post.slug)).toEqual(['segunda', 'primera']);
    expect(posts[1]?.unpublished_at).not.toBeNull();
    expect(posts[0]?.content_ref).toEqual(BREVE.content_ref);
  });
});

describe('the site’s reads (R-WEB-6)', () => {
  it('lists published posts, latest first, without their body or origin, by tag if asked', async () => {
    await put('antigua', { ...BREVE, published_at: '2026-10-01', tags: ['spain'] });
    await put('reciente', { ...BREVE, published_at: '2026-10-14' });
    await put('futura', { ...BREVE, published_at: '2999-01-01' });

    const posts = (await read('/public/posts')).json<Record<string, unknown>[]>();
    expect(posts.map((post) => post.slug)).toEqual(['reciente', 'antigua']);
    expect(posts[0]).not.toHaveProperty('body_md');
    expect(posts[0]).not.toHaveProperty('content_ref');
    expect(
      (await read('/public/posts?tag=spain')).json<{ slug: string }[]>().map((post) => post.slug),
    ).toEqual(['antigua']);
    expect(
      (await read('/public/posts?before=2026-10-10T00:00:00Z'))
        .json<{ slug: string }[]>()
        .map((post) => post.slug),
    ).toEqual(['antigua']);
  });

  it('pages through posts that share an instant without skipping any (before, before_slug)', async () => {
    for (const name of ['c-tercera', 'a-primera', 'b-segunda']) {
      await put(name, { ...BREVE, published_at: '2026-10-01T09:00:00Z' });
    }
    await put('d-anterior', { ...BREVE, published_at: '2026-09-30T09:00:00Z' });
    const slugs = async (url: string) =>
      (await read(url)).json<{ slug: string; published_at: string }[]>();

    const first = await slugs('/public/posts?limit=2');
    expect(first.map((post) => post.slug)).toEqual(['a-primera', 'b-segunda']);
    const last = first.at(-1);
    const next = await slugs(
      `/public/posts?limit=2&before=${last?.published_at}&before_slug=${last?.slug}`,
    );
    expect(next.map((post) => post.slug)).toEqual(['c-tercera', 'd-anterior']);
    // `before` alone still means "published before".
    expect(
      (await slugs(`/public/posts?before=${last?.published_at}`)).map((post) => post.slug),
    ).toEqual(['d-anterior']);
    expect((await read('/public/posts?before_slug=a-primera')).statusCode).toBe(400);
    expect((await read('/public/posts?before=%2B275760-01-01T00:00:00Z')).statusCode).toBe(400);
  });

  it('publishes a post dated without a time at midnight in Madrid, not UTC', async () => {
    await put('verano', { ...BREVE, published_at: '2026-10-15' });
    await put('invierno', { ...BREVE, published_at: '2026-12-01' });
    const posts = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      { slug: string; published_at: string }[]
    >();
    const at = Object.fromEntries(posts.map((post) => [post.slug, post.published_at]));
    expect(at).toEqual({
      verano: '2026-10-14T22:00:00.000Z',
      invierno: '2026-11-30T23:00:00.000Z',
    });
  });

  it('gives one post with its body and sources, never its origin; 404 if it never was', async () => {
    await put('informe-de-ejemplo', BREVE);
    const post = await read('/public/posts/informe-de-ejemplo');
    expect(post.statusCode).toBe(200);
    expect(post.json()).toMatchObject({ body_md: BODY, sources: BREVE.sources });
    expect(post.json()).not.toHaveProperty('content_ref');
    expect(post.headers['cache-control']).toBe('no-store');
    expect((await read('/public/posts/no-existe')).statusCode).toBe(404);
  });

  it('counts published posts per tag', async () => {
    await put('una', BREVE);
    await put('otra', { ...BREVE, tags: ['labs'] });
    expect((await read('/public/tags')).json()).toEqual([
      { tag: 'evals', posts: 1 },
      { tag: 'labs', posts: 2 },
    ]);
  });

  it('needs no token, and answers 503 without the public role’s connection', async () => {
    expect((await read('/public/tags')).statusCode).toBe(200);
    const bare = buildApp({ apiToken: TOKEN, db });
    expect((await bare.inject({ method: 'GET', url: '/public/posts' })).statusCode).toBe(503);
    await bare.close();
  });
});
