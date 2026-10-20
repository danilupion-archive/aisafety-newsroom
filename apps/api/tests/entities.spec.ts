import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { appDatabase, asSuperuser, emptyTables, publicDatabase } from './db.js';

const TOKEN = 'a'.repeat(43);
const auth = { authorization: `Bearer ${TOKEN}` };

/** An obviously fictional organisation of the registry (D23). */
const LAB = {
  type: 'organisation',
  name: 'Example Lab',
  names: { es: 'Laboratorio de Ejemplo' },
  descriptions: { es: 'Un laboratorio ficticio de ejemplo.', en: 'A fictional example lab.' },
  wikidata: 'Q999999999',
  content_ref: { path: 'entities/example-lab.md', commit: 'abc1234' },
};

/** An obviously fictional person, with no Wikidata item. */
const PERSON = {
  type: 'person',
  name: 'Ana Ejemplo',
  descriptions: { es: 'Investigadora ficticia.', en: 'A fictional researcher.' },
  wikidata: null,
  content_ref: { path: 'entities/ana-ejemplo.md', commit: 'abc1234' },
};

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
  tags: ['labs'],
  published_at: '2026-10-15T10:00:00+02:00',
  news_date: '2026-10-14',
  content_ref: { path: 'posts/es/2026-10-15-informe-de-ejemplo.md', commit: 'abc1234' },
};

const EN_BREVE = {
  ...BREVE,
  title: 'A fictional lab publishes its report',
  summary: 'Example summary.',
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

const putEntity = (id: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/api/v1/entities/${id}`, headers: auth, payload });
const removeEntity = (id: string) =>
  app.inject({ method: 'DELETE', url: `/api/v1/entities/${id}`, headers: auth });
const listEntities = async () =>
  (await app.inject({ method: 'GET', url: '/api/v1/entities', headers: auth })).json<
    Record<string, unknown>[]
  >();
const putPost = (address: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/api/v1/posts/${address}`, headers: auth, payload });
const read = (url: string) => app.inject({ method: 'GET', url });

const pushed = async (response: Promise<{ statusCode: number; body: string }>) => {
  const { statusCode, body } = await response;
  expect(statusCode, body).toBeLessThan(300);
};

/** The registry's two fictional entities, pushed. */
const registry = async () => {
  await pushed(putEntity('example-lab', LAB));
  await pushed(putEntity('ana-ejemplo', PERSON));
};

/** A story in both languages (D11), each version naming the entities given. */
const story = async (
  slug: string,
  entities: string[],
  extra: { es?: object; en?: object; enEntities?: string[] } = {},
) => {
  await pushed(putPost(`es/${slug}`, { ...BREVE, entities, ...extra.es }));
  await pushed(
    putPost(`en/${slug}-en`, {
      ...EN_BREVE,
      entities: extra.enEntities ?? entities,
      translation_of: { lang: 'es', slug },
      ...extra.en,
    }),
  );
};

const slugs = async (url: string) =>
  (await read(url)).json<{ slug: string }[]>().map((post) => post.slug);

describe('PUT /api/v1/entities/:id (D23)', () => {
  it('creates an entity (201), then replaces it (200), the same push giving the same entity', async () => {
    const created = await putEntity('example-lab', LAB);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: 'example-lab',
      type: 'organisation',
      name: 'Example Lab',
      names: { es: 'Laboratorio de Ejemplo', en: null },
      descriptions: LAB.descriptions,
      wikidata: 'Q999999999',
      content_ref: LAB.content_ref,
      created_at: expect.any(String),
      updated_at: expect.any(String),
      deleted_at: null,
      taken_down_at: null,
    });
    const again = await putEntity('example-lab', LAB);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ names: { es: 'Laboratorio de Ejemplo', en: null } });
    // What a push leaves out, it clears: no names of its own, no Wikidata item.
    const { names: _, wikidata: __, ...bare } = LAB;
    expect((await putEntity('example-lab', bare)).json()).toMatchObject({
      names: { es: null, en: null },
      wikidata: null,
    });
  });

  it('refuses an id that isn’t a tag’s shape, a type it doesn’t know, and anything but its own fields', async () => {
    const refused = async (id: string, payload: object) => {
      const response = await putEntity(id, payload);
      expect(response.statusCode, id).toBe(400);
      return response.json<{ error: string }>().error;
    };
    expect(await refused('Example-Lab', LAB)).toBe(
      'id: an entity is named like a tag: lowercase words joined by hyphens',
    );
    expect(await refused('a'.repeat(61), LAB)).toMatch(/^id: /);
    expect(await refused('example-lab', { ...LAB, type: 'company' })).toMatch(/^type: /);
    expect(
      await refused('example-lab', { ...LAB, descriptions: { es: LAB.descriptions.es } }),
    ).toMatch(/^descriptions\.en: /);
    expect(
      await refused('example-lab', {
        ...LAB,
        descriptions: { ...LAB.descriptions, en: 'x'.repeat(161) },
      }),
    ).toMatch(/^descriptions\.en: /);
    expect(await refused('example-lab', { ...LAB, names: { fr: 'Laboratoire' } })).toBe(
      'names: Unrecognized key: "fr"',
    );
    expect(await refused('example-lab', { ...LAB, wikidata: 'P31' })).toBe(
      'wikidata: a Wikidata item is Q and its number',
    );
    // aisafety-media's aliases stay there until search uses them (R-WEB-20).
    expect(await refused('example-lab', { ...LAB, aliases: ['EL'] })).toBe(
      'Unrecognized key: "aliases"',
    );
  });

  it('needs the token', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/entities/example-lab',
      payload: LAB,
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('DELETE /api/v1/entities/:id (D23, R-API-6)', () => {
  it('refuses (409) while any post names it, unpublished ones included, listing them', async () => {
    await registry();
    await story('informe-de-ejemplo', ['example-lab']);
    await pushed(
      putPost('es/retirada', { ...BREVE, entities: ['example-lab'], unpublished: true }),
    );
    const response = await removeEntity('example-lab');
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error:
        'Entity example-lab is named by es/informe-de-ejemplo, es/retirada, en/informe-de-ejemplo-en: push them without it first',
      posts: [
        { lang: 'es', slug: 'informe-de-ejemplo' },
        { lang: 'es', slug: 'retirada' },
        { lang: 'en', slug: 'informe-de-ejemplo-en' },
      ],
    });
  });

  it('marks it deleted, so no post can name it, and a push brings it back; 404 if it never was', async () => {
    await registry();
    const deleted = await removeEntity('example-lab');
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ id: 'example-lab', deleted_at: expect.any(String) });
    // Again, it keeps when.
    expect((await removeEntity('example-lab')).json()).toEqual(deleted.json());
    expect((await putPost('es/informe', { ...BREVE, entities: ['example-lab'] })).json()).toEqual({
      error: 'Entity example-lab isn’t in the registry: PUT /api/v1/entities/example-lab first',
    });
    expect((await putEntity('example-lab', LAB)).json()).toMatchObject({ deleted_at: null });
    await pushed(putPost('es/informe', { ...BREVE, entities: ['example-lab'] }));
    expect((await removeEntity('no-such-lab')).statusCode).toBe(404);
    expect((await removeEntity('No-Such-Lab')).statusCode).toBe(400);
  });
});

describe('GET /api/v1/entities', () => {
  it('lists every entity for aisafety-media to reconcile, deleted and hidden ones included', async () => {
    await registry();
    await removeEntity('ana-ejemplo');
    await asSuperuser(`UPDATE app.entities SET taken_down_at = now() WHERE id = 'example-lab'`);
    const entities = await listEntities();
    expect(entities.map((entity) => entity.id)).toEqual(['ana-ejemplo', 'example-lab']);
    expect(entities[0]).toMatchObject({ deleted_at: expect.any(String), taken_down_at: null });
    expect(entities[1]).toMatchObject({
      content_ref: LAB.content_ref,
      deleted_at: null,
      taken_down_at: expect.any(String),
    });
  });
});

describe('posts name entities (R-API-6)', () => {
  it('keeps a post’s entities in order, and lists them for aisafety-media to reconcile', async () => {
    await registry();
    const response = await putPost('es/informe', {
      ...BREVE,
      entities: ['example-lab', 'ana-ejemplo'],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ entities: ['example-lab', 'ana-ejemplo'] });
    const posts = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      { slug: string; entities: string[] }[]
    >();
    expect(posts).toMatchObject([{ slug: 'informe', entities: ['example-lab', 'ana-ejemplo'] }]);
    // A client older than entities sends none: the post names none.
    expect((await putPost('es/informe', BREVE)).json()).toMatchObject({ entities: [] });
  });

  it('refuses an entity the registry doesn’t have, naming it, and one listed twice, past ten, or on a page', async () => {
    await registry();
    const refused = async (address: string, payload: object) => {
      const response = await putPost(address, payload);
      expect(response.statusCode, address).toBe(400);
      return response.json<{ error: string }>().error;
    };
    expect(await refused('es/informe', { ...BREVE, entities: ['no-such-lab'] })).toBe(
      'Entity no-such-lab isn’t in the registry: PUT /api/v1/entities/no-such-lab first',
    );
    expect(
      await refused('es/informe', {
        ...BREVE,
        entities: ['no-such-lab', 'example-lab', 'other-lab'],
      }),
    ).toBe(
      'Entities no-such-lab, other-lab aren’t in the registry: PUT /api/v1/entities/<id> first',
    );
    expect(
      await refused('es/informe', { ...BREVE, entities: ['example-lab', 'example-lab'] }),
    ).toBe('entities: example-lab is listed twice');
    expect(
      await refused('es/informe', {
        ...BREVE,
        entities: Array.from({ length: 11 }, (_, i) => `lab-${i}`),
      }),
    ).toMatch(/^entities: /);
    expect(await refused('es/informe', { ...BREVE, entities: ['Example-Lab'] })).toBe(
      'entities.0: an entity is named like a tag: lowercase words joined by hyphens',
    );
    expect(
      await refused('es/sobre', {
        ...BREVE,
        type: 'page',
        sources: [],
        news_date: undefined,
        entities: ['example-lab'],
      }),
    ).toBe('entities: a page names no entities');
  });
});

describe('the site’s reads of entities (R-WEB-20)', () => {
  it('gives each post its entities in its language, without those the bot hid', async () => {
    await registry();
    await pushed(putEntity('hidden-lab', { ...LAB, name: 'Hidden Lab', names: {} }));
    await asSuperuser(`UPDATE app.entities SET taken_down_at = now() WHERE id = 'hidden-lab'`);
    await story('informe', ['example-lab', 'hidden-lab', 'ana-ejemplo']);
    const lab = { id: 'example-lab', type: 'organisation', wikidata: 'Q999999999' };
    const person = { id: 'ana-ejemplo', type: 'person', name: 'Ana Ejemplo', wikidata: null };
    expect((await read('/public/posts/es/informe')).json()).toMatchObject({
      entities: [{ ...lab, name: 'Laboratorio de Ejemplo' }, person],
    });
    expect((await read('/public/posts?lang=en')).json()).toMatchObject([
      { slug: 'informe-en', entities: [{ ...lab, name: 'Example Lab' }, person] },
    ]);
  });

  it('lists an entity’s posts like a tag’s, in both orders and page by page', async () => {
    await registry();
    await story('primera', ['example-lab'], {
      es: { published_at: '2026-10-01T09:00:00Z', news_date: '2026-09-20' },
      en: { published_at: '2026-10-01T09:00:00Z', news_date: '2026-09-20' },
    });
    await story('segunda', ['example-lab', 'ana-ejemplo'], {
      es: { published_at: '2026-10-02T09:00:00Z', news_date: '2026-09-10' },
      en: { published_at: '2026-10-02T09:00:00Z', news_date: '2026-09-10' },
    });
    await story('tercera', ['ana-ejemplo']);
    expect(await slugs('/public/posts?lang=es&entity=example-lab')).toEqual(['segunda', 'primera']);
    expect(await slugs('/public/posts?lang=es&entity=example-lab&order=news')).toEqual([
      'primera',
      'segunda',
    ]);
    expect(
      await slugs(
        '/public/posts?lang=es&entity=example-lab&limit=1&before=2026-10-02T09:00:00.000Z',
      ),
    ).toEqual(['primera']);
    expect(await slugs('/public/posts?lang=en&entity=ana-ejemplo')).toEqual([
      'tercera-en',
      'segunda-en',
    ]);
    expect(await slugs('/public/posts?lang=es&entity=example-lab&tag=evals')).toEqual([]);
    expect(await slugs('/public/posts?lang=es&entity=no-such-lab')).toEqual([]);
    expect((await read('/public/posts?lang=es&entity=Not-An-Id')).statusCode).toBe(400);
  });

  it('lists each language’s entities that published stories name, with their counts, and gives one', async () => {
    await registry();
    await pushed(putEntity('alone-lab', { ...LAB, names: {} }));
    await pushed(putEntity('hidden-lab', { ...LAB, names: {} }));
    await asSuperuser(`UPDATE app.entities SET taken_down_at = now() WHERE id = 'hidden-lab'`);
    await story('primera', ['example-lab', 'hidden-lab']);
    await story('segunda', ['example-lab', 'ana-ejemplo'], { enEntities: ['example-lab'] });
    // Alone, a version isn't public (D11): what it names counts nowhere.
    await pushed(putPost('es/sola', { ...BREVE, entities: ['alone-lab'] }));
    const lab = {
      id: 'example-lab',
      type: 'organisation',
      wikidata: 'Q999999999',
      posts: 2,
    };
    expect((await read('/public/entities?lang=es')).json()).toEqual([
      {
        id: 'ana-ejemplo',
        type: 'person',
        name: 'Ana Ejemplo',
        description: PERSON.descriptions.es,
        wikidata: null,
        posts: 1,
      },
      { ...lab, name: 'Laboratorio de Ejemplo', description: LAB.descriptions.es },
    ]);
    expect((await read('/public/entities?lang=en')).json()).toEqual([
      { ...lab, name: 'Example Lab', description: LAB.descriptions.en },
    ]);
    expect((await read('/public/entities/example-lab?lang=en')).json()).toEqual({
      ...lab,
      name: 'Example Lab',
      description: LAB.descriptions.en,
    });
    for (const url of [
      '/public/entities/ana-ejemplo?lang=en',
      '/public/entities/hidden-lab?lang=es',
      '/public/entities/alone-lab?lang=es',
      '/public/entities/no-such-lab?lang=es',
    ]) {
      const response = await read(url);
      expect(response.statusCode, url).toBe(404);
    }
    expect((await read('/public/entities/example-lab')).statusCode).toBe(400);
    expect((await read('/public/entities')).statusCode).toBe(400);
  });
});
