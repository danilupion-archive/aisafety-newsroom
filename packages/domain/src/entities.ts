/**
 * Entities (D23): the people, organisations and laws a story is about, beside its topics. aisafety-media keeps the
 * registry (`entities/<id>.md`); the API keeps a copy and the site a page for each. The API and the site share these.
 */
export const ENTITY_TYPES = ['person', 'organisation', 'law'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** An entity's id: a tag's shape, as aisafety-media names its file (`yoshua-bengio`, `openai`). */
export const ENTITY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ENTITY_ID_MAX = 60;

export const isEntityId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= ENTITY_ID_MAX && ENTITY_ID.test(value);

/** A Wikidata item's id: `Q` and its number, as Wikidata writes it (no leading zero). */
export const WIKIDATA_ID = /^Q[1-9]\d{0,10}$/;

export const isWikidataId = (value: unknown): value is string =>
  typeof value === 'string' && WIKIDATA_ID.test(value);

/** Where an item lives on Wikidata: the link on an entity's page, and its `sameAs` (R-WEB-20, R-WEB-21). */
export const wikidataUrl = (id: string): string => `https://www.wikidata.org/wiki/${id}`;
