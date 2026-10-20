import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';
import { superuserUrl } from './env.js';

interface EntityFixture {
  type?: string;
  name?: string;
  name_es?: string;
  name_en?: string;
  wikidata?: string;
}

/** An entity of the registry (D23): an obviously fictional organisation unless the fixture says otherwise. */
const insertEntity = (client: pg.Client, id: string, fixture: EntityFixture = {}) =>
  client.query(
    `INSERT INTO app.entities
       (id, type, name, name_es, name_en, description_es, description_en, wikidata, content_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{"path": "entities/x.md", "commit": "abc1234"}')`,
    [
      id,
      fixture.type ?? 'organisation',
      fixture.name ?? 'Example Lab',
      fixture.name_es ?? null,
      fixture.name_en ?? null,
      `Descripción de ${id}.`,
      `Description of ${id}.`,
      fixture.wikidata ?? null,
    ],
  );

interface PostFixture {
  lang?: 'es' | 'en';
  translation_of?: string;
  type?: string;
  unpublished?: boolean;
  entities?: string[];
}

const insertPost = (client: pg.Client, slug: string, fixture: PostFixture = {}) => {
  const type = fixture.type ?? 'breve';
  const [ofLang, ofSlug] = fixture.translation_of?.split('/') ?? [null, null];
  return client.query(
    `INSERT INTO app.posts
       (slug, lang, translation_of_lang, translation_of_slug, type, title, body_md, published_at, content_ref, news_date,
        unpublished_at, entities)
     VALUES ($1, $2, $3, $4, $5, 'Un título de ejemplo', 'Texto de ejemplo.', '2026-10-01', '{"path": "posts/x.md"}', $6,
       $7, $8)`,
    [
      slug,
      fixture.lang ?? 'es',
      ofLang,
      ofSlug,
      type,
      type === 'page' ? null : '2026-09-30',
      fixture.unpublished ? '2026-10-10' : null,
      fixture.entities ?? [],
    ],
  );
};

/** A story in both languages (D11), each version naming the entities given. */
const story = async (
  client: pg.Client,
  slug: string,
  entities: string[],
  options: { enEntities?: string[]; unpublished?: boolean } = {},
) => {
  await insertPost(client, slug, { entities, unpublished: options.unpublished });
  await insertPost(client, `${slug}-en`, {
    lang: 'en',
    translation_of: `es/${slug}`,
    entities: options.enEntities ?? entities,
  });
};

const NAMED = { code: '23503', constraint: 'posts_entities_known' };

describe('app.entities (D23)', () => {
  it('keeps the registry’s entities: an id in a tag’s shape, a type, names, a line in each language, a Wikidata item', async () => {
    await inRolledBackTransaction(async (client) => {
      await insertEntity(client, 'example-lab', { wikidata: 'Q999999999' });
      for (const id of ['Example-Lab', 'ejemplo ñ', '-lab', 'a--b', 'a'.repeat(61)]) {
        expect(
          await failure(client, `UPDATE app.entities SET id = $1 WHERE id = 'example-lab'`, [id]),
          id,
        ).toEqual({ code: '23514', constraint: 'entities_id_format' });
      }
      expect(
        await failure(client, `UPDATE app.entities SET type = 'company' WHERE id = 'example-lab'`),
      ).toEqual({ code: '22P02' });
      for (const [column, value, constraint] of [
        ['name', '', 'entities_name_length'],
        ['name_es', '', 'entities_name_es_length'],
        ['name_en', 'x'.repeat(201), 'entities_name_en_length'],
        ['description_es', '', 'entities_description_es_length'],
        ['description_en', 'x'.repeat(161), 'entities_description_en_length'],
        ['wikidata', 'P31', 'entities_wikidata_format'],
        ['wikidata', 'Q0', 'entities_wikidata_format'],
        ['content_ref', '[]', 'entities_content_ref_object'],
      ] as const) {
        expect(
          await failure(client, `UPDATE app.entities SET ${column} = $1 WHERE id = 'example-lab'`, [
            value,
          ]),
          `${column} = ${value}`,
        ).toEqual({ code: '23514', constraint });
      }
      expect(
        await failure(
          client,
          `UPDATE app.entities SET description_en = $1 WHERE id = 'example-lab'`,
          ['x'.repeat(160)],
        ),
      ).toBeNull();
    });
  });

  it('lets a post name only entities in the registry and not deleted, at most ten, and a page none (R-API-6)', async () => {
    await inRolledBackTransaction(async (client) => {
      await insertEntity(client, 'example-lab');
      await insertEntity(client, 'gone-lab');
      await client.query(`UPDATE app.entities SET deleted_at = now() WHERE id = 'gone-lab'`);
      // As the API pushes: the check locks the entities a post names, which takes the role's UPDATE grant.
      await client.query('SET LOCAL ROLE newsroom_app');
      await insertPost(client, 'con-entidad', { entities: ['example-lab'] });
      for (const entities of [['no-such-lab'], ['example-lab', 'no-such-lab'], ['gone-lab']]) {
        expect(
          await failure(client, `UPDATE app.posts SET entities = $1 WHERE slug = 'con-entidad'`, [
            entities,
          ]),
          entities.join(),
        ).toEqual(NAMED);
      }
      expect(
        await failure(client, `UPDATE app.posts SET entities = $1 WHERE slug = 'con-entidad'`, [
          Array.from({ length: 11 }, () => 'example-lab'),
        ]),
      ).toEqual({ code: '23514', constraint: 'posts_entities_list' });
      expect(
        await failure(
          client,
          `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, entities)
           VALUES ('una-pagina', 'es', 'page', 't', 'b', now(), '{}', '{example-lab}')`,
        ),
      ).toEqual({ code: '23514', constraint: 'posts_page_has_no_entities' });
      // A post that names none needs no registry at all.
      await insertPost(client, 'sin-entidades');
    });
  });

  it('never deletes an entity a post names, unpublished posts included; deleted, a push brings it back', async () => {
    await inRolledBackTransaction(async (client) => {
      await insertEntity(client, 'example-lab');
      await client.query('SET LOCAL ROLE newsroom_app');
      await insertPost(client, 'retirada', { entities: ['example-lab'], unpublished: true });
      const deleteIt = `UPDATE app.entities SET deleted_at = now() WHERE id = 'example-lab'`;
      expect(await failure(client, deleteIt)).toEqual(NAMED);
      await client.query(`UPDATE app.posts SET entities = '{}' WHERE slug = 'retirada'`);
      expect(await failure(client, deleteIt)).toBeNull();
      // Nothing is deleted (R-DB-2): the row stays, marked, and the runtime role can't remove it.
      expect(await failure(client, `DELETE FROM app.entities`)).toEqual({ code: '42501' });
      await client.query(`UPDATE app.entities SET deleted_at = NULL WHERE id = 'example-lab'`);
      await client.query(`UPDATE app.posts SET entities = '{example-lab}' WHERE slug = 'retirada'`);
    });
  });

  it('gives each published post its entities in its language and order, without those the bot hid (R-CAP-12)', async () => {
    const shown = await inRolledBackTransaction(async (client) => {
      await insertEntity(client, 'ana-ejemplo', { type: 'person', name: 'Ana Ejemplo' });
      await insertEntity(client, 'example-lab', {
        name: 'Example Lab',
        name_es: 'Laboratorio de Ejemplo',
        wikidata: 'Q999999999',
      });
      await insertEntity(client, 'example-act', {
        type: 'law',
        name: 'Ley de Ejemplo',
        name_en: 'Example Act',
      });
      await insertEntity(client, 'hidden-lab');
      await client.query(`UPDATE app.entities SET taken_down_at = now() WHERE id = 'hidden-lab'`);
      await story(client, 'historia', ['example-lab', 'hidden-lab', 'ana-ejemplo', 'example-act']);
      await client.query('SET LOCAL ROLE newsroom_public');
      expect(await failure(client, 'SELECT FROM app.entities')).toEqual({ code: '42501' });
      const { rows } = await client.query<{ lang: string; entities: unknown }>(
        'SELECT lang, entities FROM app.published_posts ORDER BY lang',
      );
      return rows;
    });
    expect(shown).toEqual([
      {
        lang: 'es',
        entities: [
          {
            id: 'example-lab',
            type: 'organisation',
            name: 'Laboratorio de Ejemplo',
            wikidata: 'Q999999999',
          },
          { id: 'ana-ejemplo', type: 'person', name: 'Ana Ejemplo', wikidata: null },
          { id: 'example-act', type: 'law', name: 'Ley de Ejemplo', wikidata: null },
        ],
      },
      {
        lang: 'en',
        entities: [
          { id: 'example-lab', type: 'organisation', name: 'Example Lab', wikidata: 'Q999999999' },
          { id: 'ana-ejemplo', type: 'person', name: 'Ana Ejemplo', wikidata: null },
          { id: 'example-act', type: 'law', name: 'Example Act', wikidata: null },
        ],
      },
    ]);
  });

  it('lists, for each language, every entity a published story names, with its count, name and description in it', async () => {
    const listed = await inRolledBackTransaction(async (client) => {
      await insertEntity(client, 'example-lab', {
        name_es: 'Laboratorio de Ejemplo',
        wikidata: 'Q1',
      });
      await insertEntity(client, 'ana-ejemplo', { type: 'person', name: 'Ana Ejemplo' });
      await insertEntity(client, 'only-unpublished');
      await insertEntity(client, 'only-alone');
      await insertEntity(client, 'hidden-lab');
      await insertEntity(client, 'unnamed-lab');
      await client.query(`UPDATE app.entities SET taken_down_at = now() WHERE id = 'hidden-lab'`);
      await story(client, 'primera', ['example-lab', 'hidden-lab']);
      // The second story's versions differ: each language counts its own.
      await story(client, 'segunda', ['example-lab', 'ana-ejemplo'], {
        enEntities: ['example-lab'],
      });
      await story(client, 'retirada', ['only-unpublished'], { unpublished: true });
      // A version alone is never public (D11).
      await insertPost(client, 'sola', { entities: ['only-alone'] });
      await client.query('SET LOCAL ROLE newsroom_public');
      const { rows } = await client.query<Record<string, unknown>>(
        'SELECT * FROM app.public_entities ORDER BY lang, id',
      );
      return rows;
    });
    expect(listed).toEqual([
      {
        lang: 'es',
        id: 'ana-ejemplo',
        type: 'person',
        name: 'Ana Ejemplo',
        description: 'Descripción de ana-ejemplo.',
        wikidata: null,
        posts: 1,
      },
      {
        lang: 'es',
        id: 'example-lab',
        type: 'organisation',
        name: 'Laboratorio de Ejemplo',
        description: 'Descripción de example-lab.',
        wikidata: 'Q1',
        posts: 2,
      },
      {
        lang: 'en',
        id: 'example-lab',
        type: 'organisation',
        name: 'Example Lab',
        description: 'Description of example-lab.',
        wikidata: 'Q1',
        posts: 2,
      },
    ]);
  });

  it('never lets a push and a deletion cross: whichever comes second sees the other', async () => {
    const connect = async () => {
      const client = new pg.Client({ connectionString: superuserUrl() });
      await client.connect();
      return client;
    };
    const setup = await connect();
    const [first, second] = [await connect(), await connect()];
    const cleanup = async () => {
      await setup.query("DELETE FROM app.posts WHERE slug LIKE 'race-%'");
      await setup.query("DELETE FROM app.entities WHERE id LIKE 'race-%'");
    };
    const outcome = (query: Promise<unknown>) =>
      query.then(
        () => null,
        (error: { constraint?: string }) => error.constraint ?? 'failed',
      );
    const deleteIt = `UPDATE app.entities SET deleted_at = now() WHERE id = 'race-lab'`;
    try {
      await cleanup();
      await insertEntity(setup, 'race-lab');

      // A deletion under way, then a push naming the entity: the push waits for it, and sees it deleted.
      await first.query('BEGIN');
      await first.query(deleteIt);
      const pushing = outcome(insertPost(second, 'race-a', { entities: ['race-lab'] }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      await first.query('COMMIT');
      expect(await pushing).toBe('posts_entities_known');

      // A push under way, then a deletion: the deletion waits for it, and sees the post naming the entity.
      await setup.query(`UPDATE app.entities SET deleted_at = NULL WHERE id = 'race-lab'`);
      await first.query('BEGIN');
      await insertPost(first, 'race-b', { entities: ['race-lab'] });
      const deleting = outcome(second.query(deleteIt));
      await new Promise((resolve) => setTimeout(resolve, 200));
      await first.query('COMMIT');
      expect(await deleting).toBe('posts_entities_known');
    } finally {
      await Promise.all([first.end(), second.end()]);
      await cleanup();
      await setup.end();
    }
  });
});
