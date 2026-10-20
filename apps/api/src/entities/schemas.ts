import {
  ENTITY_ID,
  ENTITY_ID_MAX,
  ENTITY_TYPES,
  WIKIDATA_ID,
} from '@aisafety-newsroom/domain/entities';
import { z } from 'zod';

import { contentRef } from '../content-ref.js';

/** An entity's id (D23): a tag's shape, as aisafety-media names its file, at most 60 characters. */
export const entityId = z
  .string()
  .max(ENTITY_ID_MAX)
  .regex(ENTITY_ID, 'an entity is named like a tag: lowercase words joined by hyphens');

const name = z.string().trim().min(1).max(200);
const description = z.string().trim().min(1).max(160);

/**
 * `PUT /entities/:id` (§13): an entity of aisafety-media's registry as the site shows it (D23, R-WEB-20). Its aliases,
 * the names texts use for it, stay in aisafety-media until search needs them.
 */
export const entityBody = z.strictObject({
  type: z.enum(ENTITY_TYPES),
  /** The name the site shows, as the entity calls itself. */
  name,
  /** The name a language uses where it's another ("Fondo Monetario Internacional"); none, `name`. */
  names: z.strictObject({ es: name.optional(), en: name.optional() }).default({}),
  /** One public line in each language that says who or what it is. */
  descriptions: z.strictObject({ es: description, en: description }),
  /** Its Wikidata item, `Q42`, or none: the site links it, and search engines read it (R-WEB-21). */
  wikidata: z
    .string()
    .regex(WIKIDATA_ID, 'a Wikidata item is Q and its number')
    .nullable()
    .default(null),
  content_ref: contentRef,
});

export type EntityBody = z.output<typeof entityBody>;

/** An entity's address in the API's paths: `/entities/:id`. */
export const entityAddress = z.strictObject({ id: entityId });
