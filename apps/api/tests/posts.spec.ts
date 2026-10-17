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

/** About 90 words of obviously fictional English. */
const EN_BODY = Array.from(
  { length: 10 },
  (_, i) => `Example sentence number ${i + 1} about a fictional lab and its report.`,
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
  news_date: '2026-10-14',
  content_ref: { path: 'posts/es/2026-10-15-informe-de-ejemplo.md', commit: 'abc1234' },
};

const EN_BREVE = {
  ...BREVE,
  title: 'A fictional lab publishes its report',
  summary: 'Example summary.',
  body_md: EN_BODY,
  content_ref: { path: 'posts/en/2026-10-15-example-report.md', commit: 'abc1234' },
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

const put = (address: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/api/v1/posts/${address}`, headers: auth, payload });
const remove = (address: string) =>
  app.inject({ method: 'DELETE', url: `/api/v1/posts/${address}`, headers: auth });
const read = (url: string) => app.inject({ method: 'GET', url });
const pushed = async (address: string, payload: object) => {
  const response = await put(address, payload);
  expect(response.statusCode, response.body).toBeLessThan(300);
};

/**
 * A story in both languages (D11): the Spanish original at es/<slug> and its English translation at en/<enSlug>,
 * each with its own changes. The site shows a post only with its other version.
 */
const story = async (slug: string, enSlug: string, es: object = {}, en: object = {}) => {
  await pushed(`es/${slug}`, { ...BREVE, ...es });
  await pushed(`en/${enSlug}`, { ...EN_BREVE, ...en, translation_of: { lang: 'es', slug } });
};
const slugs = async (url: string) =>
  (await read(url)).json<{ slug: string }[]>().map((post) => post.slug);

describe('PUT /api/v1/posts/:lang/:slug (§13)', () => {
  it('creates a post (201), then replaces it (200), the same push giving the same post', async () => {
    const created = await put('es/informe-de-ejemplo', BREVE);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      lang: 'es',
      slug: 'informe-de-ejemplo',
      type: 'breve',
      tags: ['labs', 'evals'],
      translation_of: null,
    });

    const again = await put('es/informe-de-ejemplo', BREVE);
    expect(again.statusCode).toBe(200);
    const edited = await put('es/informe-de-ejemplo', { ...BREVE, title: 'Un título corregido' });
    expect(edited.json()).toMatchObject({ title: 'Un título corregido' });
  });

  it('holds an original breve to 80–150 words and 1–3 sources (R-WEB-1)', async () => {
    const short = await put('es/corta', { ...BREVE, body_md: 'Demasiado corta.' });
    expect(short.statusCode).toBe(400);
    expect(short.json()).toEqual({
      error: 'body_md: a breve is 80–150 words in the language it’s written in; this one has 2',
    });

    const source = BREVE.sources[0];
    expect(
      (
        await put('es/muchas-fuentes', { ...BREVE, sources: [source, source, source, source] })
      ).json(),
    ).toEqual({
      error: 'sources: a breve has 1–3 sources',
    });
    expect((await put('es/sin-fuentes', { ...BREVE, sources: [] })).statusCode).toBe(400);
  });

  it('holds an English original to the same 80–150 words', async () => {
    expect((await put('en/example-report', EN_BREVE)).statusCode).toBe(201);
    const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
    expect((await put('en/too-short', { ...EN_BREVE, body_md: words(79) })).statusCode).toBe(400);
    expect((await put('en/too-long', { ...EN_BREVE, body_md: words(151) })).statusCode).toBe(400);
    expect((await put('en/just-right', { ...EN_BREVE, body_md: words(150) })).statusCode).toBe(201);
  });

  it('gives a translation no length of its own: it says what its original says (D15)', async () => {
    expect((await put('es/informe-de-ejemplo', BREVE)).statusCode).toBeLessThan(300);
    const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
    const translation = {
      ...EN_BREVE,
      translation_of: { lang: 'es', slug: 'informe-de-ejemplo' },
    };
    expect((await put('en/translation', { ...translation, body_md: words(190) })).statusCode).toBe(
      201,
    );
    expect((await put('en/translation', { ...translation, body_md: words(60) })).statusCode).toBe(
      200,
    );
  });

  it('lets an article run long, but still with its sources', async () => {
    const article = { ...BREVE, type: 'article', body_md: `${BODY}\n\n`.repeat(20) };
    expect((await put('es/un-articulo', article)).statusCode).toBe(201);
    expect((await put('es/otro-articulo', { ...article, sources: [] })).statusCode).toBe(400);
  });

  it('refuses a bad slug or language, a source that isn’t a web address, and anything but its own fields', async () => {
    expect((await put('es/Con-Mayusculas', BREVE)).statusCode).toBe(400);
    expect((await put('fr/un-informe', BREVE)).json()).toEqual({
      error: 'lang: a language is es or en',
    });
    const javascript = { ...BREVE, sources: [{ ...BREVE.sources[0], url: 'javascript:alert(1)' }] };
    expect((await put('es/fuente-rara', javascript)).statusCode).toBe(400);
    expect((await put('es/campo-de-mas', { ...BREVE, html: '<b>no</b>' })).statusCode).toBe(400);
    expect((await put('es/campo-de-mas', { ...BREVE, lang: 'en' })).statusCode).toBe(400);
  });

  it('needs the token', async () => {
    const response = await app.inject({ method: 'PUT', url: '/api/v1/posts/es/x', payload: BREVE });
    expect(response.statusCode).toBe(401);
  });

  it('keeps one slug apart in each language: the same name is two posts', async () => {
    await story('mismo-nombre', 'mismo-nombre');
    expect((await read('/public/posts/es/mismo-nombre')).json()).toMatchObject({
      title: BREVE.title,
    });
    expect((await read('/public/posts/en/mismo-nombre')).json()).toMatchObject({
      title: EN_BREVE.title,
    });
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
      news_date: undefined,
    };
    expect((await put('es/sobre', about)).statusCode).toBe(201);
    await pushed('en/about', {
      ...about,
      title: 'About this site',
      translation_of: { lang: 'es', slug: 'sobre' },
    });
    expect((await read('/public/posts/es/sobre')).json()).toMatchObject({
      type: 'page',
      title: 'Sobre este sitio',
      translations: [{ lang: 'en', slug: 'about', title: 'About this site' }],
    });
    expect((await read('/public/posts?lang=es')).json()).toEqual([]);
    expect((await read('/public/posts?lang=en')).json()).toEqual([]);
    expect((await read('/public/tags?lang=es')).json()).toEqual([]);
  });
});

describe('reserved slugs', () => {
  it('refuses the site’s own path words in either language, but takes each about page', async () => {
    expect((await put('es/temas', BREVE)).json()).toEqual({
      error: "temas is one of the site's own paths",
    });
    expect((await put('en/topics', EN_BREVE)).statusCode).toBe(400);
    // The other language's words too: /topics reaches the topics page's route in Spanish, refusing it.
    expect((await put('es/topics', BREVE)).statusCode).toBe(400);
    expect((await put('en/sobre', EN_BREVE)).statusCode).toBe(400);
    expect((await put('es/sobre', BREVE)).statusCode).toBe(400);
    const page = { type: 'page', body_md: 'Texto de ejemplo.', sources: [], news_date: undefined };
    expect((await put('es/sobre', { ...BREVE, ...page })).statusCode).toBe(201);
    expect((await put('en/about', { ...EN_BREVE, ...page })).statusCode).toBe(201);
    expect((await put('es/about', { ...BREVE, ...page })).statusCode).toBe(400);
  });

  it('refuses what shares the root with Spanish posts: the language prefixes and the health check', async () => {
    expect((await put('es/en', BREVE)).json()).toEqual({
      error: "en is one of the site's own paths",
    });
    expect((await put('es/es', BREVE)).statusCode).toBe(400);
    expect((await put('es/healthz', BREVE)).statusCode).toBe(400);
    expect((await put('es/img', BREVE)).statusCode).toBe(400);
    expect((await put('es/og', BREVE)).statusCode).toBe(400);
  });
});

describe('translations (R-WEB-10)', () => {
  const translation = { ...EN_BREVE, translation_of: { lang: 'es', slug: 'informe-de-ejemplo' } };

  it('links a translation to its original, and each shows the other', async () => {
    await put('es/informe-de-ejemplo', BREVE);
    const created = await put('en/example-report', translation);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      translation_of: { lang: 'es', slug: 'informe-de-ejemplo' },
    });

    expect((await read('/public/posts/es/informe-de-ejemplo')).json()).toMatchObject({
      translation_of: null,
      translations: [{ lang: 'en', slug: 'example-report', title: EN_BREVE.title }],
    });
    const english = (await read('/public/posts/en/example-report')).json<Record<string, unknown>>();
    expect(english).toMatchObject({
      translation_of: { lang: 'es', slug: 'informe-de-ejemplo' },
      translations: [{ lang: 'es', slug: 'informe-de-ejemplo', title: BREVE.title }],
    });
    expect(english).not.toHaveProperty('translation_of_lang');
  });

  it('needs the original on the site first, one translation per language, and never a chain', async () => {
    expect((await put('en/example-report', translation)).json()).toEqual({
      error: 'The post it translates hasn’t been pushed: push that one first',
    });
    await put('es/informe-de-ejemplo', BREVE);
    await put('en/example-report', translation);
    const second = await put('en/another-report', translation);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({
      error: 'That post already has a translation in this language',
    });
    const chain = await put('es/otro-informe', {
      ...BREVE,
      translation_of: { lang: 'en', slug: 'example-report' },
    });
    expect(chain.json()).toEqual({
      error: 'That post is a translation itself: translate its original',
    });
    expect(
      (await put('es/informe-de-ejemplo', { ...BREVE, translation_of: { lang: 'en', slug: 'x' } }))
        .statusCode,
    ).toBe(409);
  });

  it('refuses a translation in its own language', async () => {
    await put('es/informe-de-ejemplo', BREVE);
    const same = await put('es/otro', {
      ...BREVE,
      translation_of: { lang: 'es', slug: 'informe-de-ejemplo' },
    });
    expect(same.json()).toEqual({
      error: 'translation_of: a translation is of a post in the other language',
    });
  });
});

describe('authors (R-WEB-3, D19)', () => {
  const translation = { ...EN_BREVE, translation_of: { lang: 'es', slug: 'informe-de-ejemplo' } };

  it('takes a person’s name on a post they wrote, and shows it with its translation’s original writer', async () => {
    const signed = await put('es/informe-de-ejemplo', { ...BREVE, author: '  Autora de Ejemplo ' });
    expect(signed.statusCode).toBe(201);
    expect(signed.json()).toMatchObject({ author: 'Autora de Ejemplo' });
    await put('en/example-report', translation);

    expect((await read('/public/posts/es/informe-de-ejemplo')).json()).toMatchObject({
      author: 'Autora de Ejemplo',
      original_author: null,
    });
    // Its translation names no writer of its own: an AI translation of a signed text.
    expect((await read('/public/posts/en/example-report')).json()).toMatchObject({
      author: null,
      original_author: 'Autora de Ejemplo',
    });
    type Listed = { slug: string; author: unknown; original_author: unknown };
    const listed = (await read('/public/posts?lang=en')).json<Listed[]>();
    expect(listed.find((post) => post.slug === 'example-report')).toMatchObject({
      author: null,
      original_author: 'Autora de Ejemplo',
    });
  });

  it('leaves an AI-written post without an author, and refuses an empty or overlong name', async () => {
    expect((await put('es/informe-de-ejemplo', BREVE)).json()).toMatchObject({ author: null });
    for (const author of ['', '   ', 'x'.repeat(101)]) {
      expect((await put('es/informe-de-ejemplo', { ...BREVE, author })).statusCode).toBe(400);
    }
  });
});

describe('both languages (D11)', () => {
  it('shows neither version of a story until both are published', async () => {
    await pushed('es/informe-de-ejemplo', BREVE);
    // Its other version never pushed: never public, so 404, not 410.
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(404);
    expect((await read('/public/posts?lang=es')).json()).toEqual([]);
    expect((await read('/public/unpublished')).json()).toEqual([]);

    const translation = { ...EN_BREVE, translation_of: { lang: 'es', slug: 'informe-de-ejemplo' } };
    await pushed('en/example-report', { ...translation, published_at: '2999-01-01' });
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(404);
    expect((await read('/public/posts/en/example-report')).statusCode).toBe(404);

    await pushed('en/example-report', translation);
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(200);
    expect(await slugs('/public/posts?lang=en')).toEqual(['example-report']);
  });

  it('takes a story down in both languages when either version is unpublished (410)', async () => {
    await story('informe-de-ejemplo', 'example-report');
    await story('otro-informe', 'another-report');
    await remove('en/another-report');
    await remove('es/informe-de-ejemplo');
    for (const address of [
      'es/informe-de-ejemplo',
      'en/example-report',
      'es/otro-informe',
      'en/another-report',
    ]) {
      expect((await read(`/public/posts/${address}`)).statusCode, address).toBe(410);
    }
    expect((await read('/public/posts?lang=es')).json()).toEqual([]);
    expect((await read('/public/posts?lang=en')).json()).toEqual([]);
    expect((await read('/public/tags?lang=en')).json()).toEqual([]);
  });
});

describe('DELETE /api/v1/posts/:lang/:slug (AC-7)', () => {
  it('unpublishes a post: its story answers 410 and leaves the lists; pushing it again restores it', async () => {
    await story('informe-de-ejemplo', 'example-report');
    const deleted = await remove('es/informe-de-ejemplo');
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ lang: 'es', slug: 'informe-de-ejemplo' });

    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(410);
    expect((await read('/public/posts/en/example-report')).statusCode).toBe(410);
    expect((await read('/public/unpublished')).json()).toEqual([
      { lang: 'es', slug: 'informe-de-ejemplo' },
      { lang: 'en', slug: 'example-report' },
    ]);
    expect((await read('/public/posts?lang=es')).json()).toEqual([]);
    expect((await remove('es/informe-de-ejemplo')).statusCode).toBe(200);

    await pushed('es/informe-de-ejemplo', BREVE);
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(200);
    expect((await read('/public/posts/en/example-report')).statusCode).toBe(200);
  });

  it('answers 404 for a post that never was, or that is in the other language', async () => {
    await put('es/informe-de-ejemplo', BREVE);
    expect((await remove('es/no-existe')).statusCode).toBe(404);
    expect((await remove('en/informe-de-ejemplo')).statusCode).toBe(404);
  });
});

describe('news dates (R-WEB-13)', () => {
  it('takes the day a breve’s story happened, and dates one pushed without it by its posted day', async () => {
    const created = await put('es/informe-de-ejemplo', BREVE);
    expect(created.json()).toMatchObject({ news_date: '2026-10-14' });
    // A client older than news dates: its posted day on the site's clock (22:30 UTC on the 15th is the 16th in Madrid).
    const late = await put('es/sin-fecha', {
      ...BREVE,
      news_date: undefined,
      published_at: '2026-10-15T22:30:00Z',
    });
    expect(late.statusCode).toBe(201);
    expect(late.json()).toMatchObject({ news_date: '2026-10-16' });
    const dateOnly = await put('es/solo-dia', {
      ...BREVE,
      news_date: undefined,
      published_at: '2026-10-15',
    });
    expect(dateOnly.json()).toMatchObject({ news_date: '2026-10-15' });
    const article = { ...BREVE, type: 'article', body_md: `${BODY}\n\n`.repeat(20) };
    expect(
      (await put('es/articulo-sin-fecha', { ...article, news_date: undefined })).json(),
    ).toMatchObject({
      news_date: '2026-10-15',
    });
    const page = { ...BREVE, type: 'page', body_md: 'Texto de ejemplo.', sources: [] };
    expect((await put('es/sobre', page)).json()).toEqual({
      error: 'news_date: a page has no news date',
    });
    expect(
      (await put('es/fecha-imposible', { ...BREVE, news_date: '2026-02-30' })).statusCode,
    ).toBe(400);
    expect(
      (await put('es/con-hora', { ...BREVE, news_date: '2026-10-14T10:00:00Z' })).statusCode,
    ).toBe(400);
  });

  it('lists by news date when asked, newest first; posted stays the default, and both page through', async () => {
    const dated = (published_at: string, news_date: string) => ({ published_at, news_date });
    // Posted last, about something a month old: first by posted date, last by news date.
    await story(
      'vieja',
      'old',
      dated('2026-10-14', '2026-09-01'),
      dated('2026-10-14', '2026-09-01'),
    );
    await story(
      'nueva',
      'new',
      dated('2026-10-10', '2026-10-10'),
      dated('2026-10-10', '2026-10-10'),
    );
    for (const name of ['empate-b', 'empate-a']) {
      const same = dated('2026-10-12T09:00:00Z', '2026-10-05');
      await story(name, `${name}-en`, same, same);
    }
    const list = async (url: string) =>
      (await read(url)).json<{ slug: string; published_at: string; news_date: string }[]>();

    expect(await slugs('/public/posts?lang=es')).toEqual([
      'vieja',
      'empate-a',
      'empate-b',
      'nueva',
    ]);
    const byNews = await list('/public/posts?lang=es&order=news');
    expect(byNews.map((post) => [post.slug, post.news_date])).toEqual([
      ['nueva', '2026-10-10'],
      ['empate-a', '2026-10-05'],
      ['empate-b', '2026-10-05'],
      ['vieja', '2026-09-01'],
    ]);

    const first = await list('/public/posts?lang=es&order=news&limit=2');
    const last = first.at(-1);
    const next = await list(
      `/public/posts?lang=es&order=news&limit=2&before_date=${last?.news_date}&before=${last?.published_at}&before_slug=${last?.slug}`,
    );
    expect(next.map((post) => post.slug)).toEqual(['empate-b', 'vieja']);
    // The day alone: stories from before it.
    expect(await slugs('/public/posts?lang=es&order=news&before_date=2026-10-05')).toEqual([
      'vieja',
    ]);

    expect((await read('/public/posts?lang=es&before_date=2026-10-05')).statusCode).toBe(400);
    expect(
      (await read(`/public/posts?lang=es&order=news&before=${last?.published_at}`)).statusCode,
    ).toBe(400);
    expect((await read('/public/posts?lang=es&order=oldest')).statusCode).toBe(400);
  });

  it('shows a story only while both versions carry the same news date', async () => {
    await story('desfase', 'mismatch', {}, { news_date: '2026-10-13' });
    expect((await read('/public/posts/es/desfase')).statusCode).toBe(404);
    expect((await read('/public/posts?lang=en')).json()).toEqual([]);
    await pushed('en/mismatch', { ...EN_BREVE, translation_of: { lang: 'es', slug: 'desfase' } });
    expect((await read('/public/posts/es/desfase')).json()).toMatchObject({
      news_date: '2026-10-14',
    });
    const posts = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      { news_date: string | null }[]
    >();
    expect(posts.map((post) => post.news_date)).toEqual(['2026-10-14', '2026-10-14']);
  });
});

describe('rebuilding the site (R-WEB-8)', () => {
  it('restores an unpublished post as unpublished in one push, so its translation can follow', async () => {
    const restored = await put('es/informe-de-ejemplo', { ...BREVE, unpublished: true });
    expect(restored.statusCode).toBe(201);
    expect(restored.json<{ unpublished_at: string | null }>().unpublished_at).not.toBeNull();
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(410);
    expect((await read('/public/posts?lang=es')).json()).toEqual([]);

    const translation = { ...EN_BREVE, translation_of: { lang: 'es', slug: 'informe-de-ejemplo' } };
    expect((await put('en/example-report', translation)).statusCode).toBe(201);
    // Its story is down, so the translation is gone too.
    expect((await read('/public/posts/en/example-report')).statusCode).toBe(410);
  });

  it('keeps an unpublished post’s date on a rebuild push, and publishes it on a plain one', async () => {
    await story('informe-de-ejemplo', 'example-report');
    const gone = (await remove('es/informe-de-ejemplo')).json<{ unpublished_at: string }>();
    const again = await put('es/informe-de-ejemplo', { ...BREVE, unpublished: true });
    expect(again.json<{ unpublished_at: string }>().unpublished_at).toBe(gone.unpublished_at);
    await put('es/informe-de-ejemplo', BREVE);
    expect((await read('/public/posts/es/informe-de-ejemplo')).statusCode).toBe(200);
  });
});

describe('GET /api/v1/posts', () => {
  it('lists every post for aisafety-media to reconcile, unpublished ones and their origin included (R-WEB-8)', async () => {
    await put('es/primera', BREVE);
    await put('es/segunda', { ...BREVE, published_at: '2026-10-16' });
    await put('en/second', {
      ...EN_BREVE,
      published_at: '2026-10-16',
      translation_of: { lang: 'es', slug: 'segunda' },
    });
    await remove('es/primera');
    const posts = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      {
        lang: string;
        slug: string;
        unpublished_at: string | null;
        content_ref: unknown;
        translation_of: unknown;
      }[]
    >();
    // Latest first; at one instant, Spanish first (the languages' order) and then by slug.
    expect(posts.map((post) => `${post.lang}/${post.slug}`)).toEqual([
      'es/segunda',
      'en/second',
      'es/primera',
    ]);
    expect(posts[2]?.unpublished_at).not.toBeNull();
    expect(posts[0]?.content_ref).toEqual(BREVE.content_ref);
    expect(posts[1]?.translation_of).toEqual({ lang: 'es', slug: 'segunda' });
  });
});

describe('the site’s reads (R-WEB-6)', () => {
  it('lists one language’s published posts, latest first, without their body or origin, by tag if asked', async () => {
    const old = { published_at: '2026-10-01', tags: ['spain'] };
    await story('antigua', 'old', old, old);
    const recent = { published_at: '2026-10-14' };
    await story('reciente', 'recent', recent, recent);
    const future = { published_at: '2999-01-01' };
    await story('futura', 'future', future, future);

    const posts = (await read('/public/posts?lang=es')).json<Record<string, unknown>[]>();
    expect(posts.map((post) => post.slug)).toEqual(['reciente', 'antigua']);
    // How many sources it has, for the list's "2 fuentes", without the sources themselves.
    expect(posts[0]).toMatchObject({ lang: 'es', source_count: 1 });
    expect(posts[0]).not.toHaveProperty('sources');
    expect(posts[0]).not.toHaveProperty('body_md');
    expect(posts[0]).not.toHaveProperty('content_ref');
    expect(await slugs('/public/posts?lang=en')).toEqual(['recent', 'old']);
    expect(await slugs('/public/posts?lang=es&tag=spain')).toEqual(['antigua']);
    expect(await slugs('/public/posts?lang=es&before=2026-10-10T00:00:00Z')).toEqual(['antigua']);
    expect((await read('/public/posts')).json()).toEqual({ error: 'lang: a language is es or en' });
  });

  it('pages through posts that share an instant without skipping any (before, before_slug)', async () => {
    const at = (published_at: string) => ({ published_at });
    for (const name of ['c-tercera', 'a-primera', 'b-segunda']) {
      await story(name, `${name}-en`, at('2026-10-01T09:00:00Z'), at('2026-10-01T09:00:00Z'));
    }
    await story(
      'd-anterior',
      'd-anterior-en',
      at('2026-09-30T09:00:00Z'),
      at('2026-09-30T09:00:00Z'),
    );
    const list = async (url: string) =>
      (await read(url)).json<{ slug: string; published_at: string }[]>();

    const first = await list('/public/posts?lang=es&limit=2');
    expect(first.map((post) => post.slug)).toEqual(['a-primera', 'b-segunda']);
    const last = first.at(-1);
    const next = await list(
      `/public/posts?lang=es&limit=2&before=${last?.published_at}&before_slug=${last?.slug}`,
    );
    expect(next.map((post) => post.slug)).toEqual(['c-tercera', 'd-anterior']);
    // `before` alone still means "published before".
    expect(
      (await list(`/public/posts?lang=es&before=${last?.published_at}`)).map((post) => post.slug),
    ).toEqual(['d-anterior']);
    expect((await read('/public/posts?lang=es&before_slug=a-primera')).statusCode).toBe(400);
    expect((await read('/public/posts?lang=es&before=%2B275760-01-01T00:00:00Z')).statusCode).toBe(
      400,
    );
  });

  it('publishes a post dated without a time at midnight in Madrid, not UTC', async () => {
    await put('es/verano', { ...BREVE, published_at: '2026-10-15' });
    await put('es/invierno', { ...BREVE, published_at: '2026-12-01' });
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
    await story('informe-de-ejemplo', 'example-report');
    const post = await read('/public/posts/es/informe-de-ejemplo');
    expect(post.statusCode).toBe(200);
    expect(post.json()).toMatchObject({
      body_md: BODY,
      sources: BREVE.sources,
      translations: [{ lang: 'en', slug: 'example-report', title: EN_BREVE.title }],
    });
    expect(post.json()).not.toHaveProperty('content_ref');
    expect(post.headers['cache-control']).toBe('no-store');
    expect((await read('/public/posts/es/no-existe')).statusCode).toBe(404);
    expect((await read('/public/posts/en/informe-de-ejemplo')).statusCode).toBe(404);
    expect((await read('/public/posts/xx/informe-de-ejemplo')).statusCode).toBe(400);
  });

  it('counts one language’s published posts per tag', async () => {
    await story('una', 'one');
    await story('otra', 'other', { tags: ['labs'] }, { tags: ['labs', 'spain'] });
    // Alone, a post isn't public: its tags count nowhere.
    await pushed('es/sola', { ...BREVE, tags: ['international'] });
    expect((await read('/public/tags?lang=es')).json()).toEqual([
      { tag: 'evals', posts: 1 },
      { tag: 'labs', posts: 2 },
    ]);
    expect((await read('/public/tags?lang=en')).json()).toEqual([
      { tag: 'evals', posts: 1 },
      { tag: 'labs', posts: 2 },
      { tag: 'spain', posts: 1 },
    ]);
    expect((await read('/public/tags')).statusCode).toBe(400);
  });

  it('needs no token, and answers 503 without the public role’s connection', async () => {
    expect((await read('/public/tags?lang=es')).statusCode).toBe(200);
    const bare = buildApp({ apiToken: TOKEN, db });
    expect((await bare.inject({ method: 'GET', url: '/public/posts' })).statusCode).toBe(503);
    await bare.close();
  });
});
