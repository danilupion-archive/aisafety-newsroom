import type { Database } from '@aisafety-newsroom/db/client';
import type { EntityType } from '@aisafety-newsroom/domain/entities';

import { sql } from 'kysely';

import type { PostAddress } from '../posts/data.js';
import type { EntityBody } from './schemas.js';

/** An entity as the API returns it (D23): everything, where it came from and the bot's mark included. */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  /** A language's own name, where it's another. */
  names: { es: string | null; en: string | null };
  descriptions: { es: string; en: string };
  wikidata: string | null;
  content_ref: unknown;
  created_at: Date;
  updated_at: Date;
  /** Deleted through the API: no post can name it until it's pushed again. */
  deleted_at: Date | null;
  /** Hidden by the bot (R-CAP-12): out of everything public until its /restore entity, whatever a push says. */
  taken_down_at: Date | null;
}

interface EntityRow extends Omit<Entity, 'names' | 'descriptions'> {
  name_es: string | null;
  name_en: string | null;
  description_es: string;
  description_en: string;
}

/** A row as the API gives it out: the languages' names and descriptions together, as they're pushed. */
const shape = ({
  name_es,
  name_en,
  description_es,
  description_en,
  ...row
}: EntityRow): Entity => ({
  id: row.id,
  type: row.type,
  name: row.name,
  names: { es: name_es, en: name_en },
  descriptions: { es: description_es, en: description_en },
  wikidata: row.wikidata,
  content_ref: row.content_ref,
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at,
  taken_down_at: row.taken_down_at,
});

/**
 * Creates or replaces an entity (§13 `PUT /entities/:id`). Pushing a deleted one brings it back; a hidden one stays
 * hidden, whatever the push (R-CAP-12). The same push twice gives the same entity (R-API-3); `created` says whether
 * it's new.
 */
export const upsertEntity = async (
  db: Database,
  id: string,
  body: EntityBody,
): Promise<{ created: boolean; entity: Entity }> => {
  const values = {
    type: body.type,
    name: body.name,
    name_es: body.names.es ?? null,
    name_en: body.names.en ?? null,
    description_es: body.descriptions.es,
    description_en: body.descriptions.en,
    wikidata: body.wikidata,
    content_ref: JSON.stringify(body.content_ref),
  };
  const { created, ...row } = await db
    .insertInto('app.entities')
    .values({ id, ...values })
    .onConflict((conflict) => conflict.column('id').doUpdateSet({ ...values, deleted_at: null }))
    .returningAll()
    // A row the insert created has no previous version: xmax is 0.
    .returning(sql<boolean>`(xmax = 0)`.as('created'))
    .executeTakeFirstOrThrow();
  return { created, entity: shape(row) };
};

/** Every entity, deleted and hidden ones included, for aisafety-media to reconcile (§13 `GET /entities`). */
export const listEntities = async (db: Database): Promise<Entity[]> =>
  (await db.selectFrom('app.entities').selectAll().orderBy('id').execute()).map(shape);

/**
 * Deletes an entity (§13 `DELETE /entities/:id`): marks it, so no post can name it, and keeps the row (R-DB-2); a push
 * brings it back. Refused while any post names it, unpublished ones included, which it lists; the database refuses it
 * too, should a push naming it come in between (R-API-6). Undefined if there's no such entity.
 */
export const deleteEntity = async (
  db: Database,
  id: string,
): Promise<
  | { kind: 'deleted'; id: string; deleted_at: Date }
  | { kind: 'named'; posts: PostAddress[] }
  | undefined
> => {
  const posts = await db
    .selectFrom('app.posts')
    .select(['lang', 'slug'])
    .where(sql<boolean>`entities @> ARRAY[${id}]::text[]`)
    .orderBy('lang')
    .orderBy('slug')
    .execute();
  if (posts.length > 0) {
    return { kind: 'named', posts };
  }
  const row = await db
    .updateTable('app.entities')
    // Already deleted, it keeps when.
    .set({ deleted_at: sql<Date>`coalesce(deleted_at, now())` })
    .where('id', '=', id)
    .returning(['id', 'deleted_at'])
    .executeTakeFirst();
  return row?.deleted_at ? { kind: 'deleted', id: row.id, deleted_at: row.deleted_at } : undefined;
};

/** Of the entities a post names, those the registry doesn't have or deleted, in the post's order (R-API-6). */
export const unknownEntities = async (db: Database, ids: readonly string[]): Promise<string[]> => {
  if (ids.length === 0) {
    return [];
  }
  const known = await db
    .selectFrom('app.entities')
    .select('id')
    .where('id', 'in', ids)
    .where('deleted_at', 'is', null)
    .execute();
  const found = new Set(known.map((row) => row.id));
  return ids.filter((id) => !found.has(id));
};
