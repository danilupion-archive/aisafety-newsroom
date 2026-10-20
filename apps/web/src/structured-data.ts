import { type EntityType, wikidataUrl } from '@aisafety-newsroom/domain/entities';

import type { Entity, EntityRef, PostSummary } from './api';
import type { Lang } from './i18n';

/**
 * Structured data (R-WEB-21): what search engines read of a post and of an entity's page, as schema.org JSON-LD. Each
 * entity is the thing itself, with its Wikidata item as `sameAs`, so a search engine knows which one it is.
 */
const SCHEMA_TYPES: Record<EntityType, string> = {
  person: 'Person',
  organisation: 'Organization',
  law: 'Legislation',
};

const CONTEXT = 'https://schema.org';

const thing = (entity: EntityRef & { description?: string }) => ({
  '@type': SCHEMA_TYPES[entity.type],
  name: entity.name,
  ...(entity.description === undefined ? {} : { description: entity.description }),
  ...(entity.wikidata === null ? {} : { sameAs: wikidataUrl(entity.wikidata) }),
});

/** A breve is a news article, an article an article; each `about` its entities. Pages have none. */
export const postStructuredData = (
  post: Pick<
    PostSummary,
    'lang' | 'type' | 'title' | 'summary' | 'published_at' | 'updated_at' | 'entities'
  >,
  url: string,
) => {
  const entities = post.entities ?? [];
  return {
    '@context': CONTEXT,
    '@type': post.type === 'article' ? 'Article' : 'NewsArticle',
    headline: post.title,
    ...(post.summary === '' ? {} : { description: post.summary }),
    inLanguage: post.lang,
    url,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    ...(entities.length === 0 ? {} : { about: entities.map((entity) => thing(entity)) }),
  };
};

/** An entity's page lists its stories, and is about the entity itself, described in the page's language. */
export const entityStructuredData = (lang: Lang, entity: Entity, url: string) => ({
  '@context': CONTEXT,
  '@type': 'CollectionPage',
  name: entity.name,
  inLanguage: lang,
  url,
  mainEntity: thing({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    wikidata: entity.wikidata,
    description: entity.description,
  }),
});

/**
 * The data as a script's text: JSON with every `<` escaped, so nothing in a name or a description can close the script
 * or open another. It reads back as the same JSON.
 */
export const jsonLd = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
