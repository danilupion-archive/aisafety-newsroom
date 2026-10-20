import { describe, expect, it } from 'vitest';

import { ENTITY_TYPES, isEntityId, isWikidataId, wikidataUrl } from './entities.js';

describe('entities (D23)', () => {
  it('names an entity like a tag, at most 60 characters', () => {
    expect(['example-lab', 'ana-ejemplo', 'q2', 'a'.repeat(60)].every(isEntityId)).toBe(true);
    for (const id of [
      'Example-Lab',
      'example lab',
      'ejemplo-ñ',
      '-lab',
      'lab-',
      'a--b',
      '',
      'a'.repeat(61),
    ]) {
      expect(isEntityId(id), id).toBe(false);
    }
    expect(isEntityId(undefined)).toBe(false);
  });

  it('knows three types: people, organisations and laws', () => {
    expect(ENTITY_TYPES).toEqual(['person', 'organisation', 'law']);
  });

  it('links a Wikidata item by its id, and takes nothing else for one', () => {
    expect(wikidataUrl('Q999999999')).toBe('https://www.wikidata.org/wiki/Q999999999');
    expect(['Q1', 'Q999999999'].every(isWikidataId)).toBe(true);
    for (const id of ['Q0', 'Q01', 'q42', 'P31', 'Q', 'Q42 ', `Q${'9'.repeat(12)}`]) {
      expect(isWikidataId(id), id).toBe(false);
    }
  });
});
