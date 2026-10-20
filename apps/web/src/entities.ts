import { ENTITY_TYPES, type EntityType } from '@aisafety-newsroom/domain/entities';

import type { Entity } from './api';
import type { Lang } from './i18n';

import { STRINGS } from './strings';

/**
 * The entities' index (R-WEB-20): people, organisations and laws, in that order, each group by name as the page's
 * language sorts it ("Álvaro" among the A's). A type no published story names has no group.
 */
export const groupEntities = (
  lang: Lang,
  entities: readonly Entity[],
): { type: EntityType; entities: Entity[] }[] => {
  const collator = new Intl.Collator(STRINGS[lang].locale);
  return ENTITY_TYPES.map((type) => ({
    type,
    entities: entities
      .filter((entity) => entity.type === type)
      .toSorted((a, b) => collator.compare(a.name, b.name)),
  })).filter((group) => group.entities.length > 0);
};
