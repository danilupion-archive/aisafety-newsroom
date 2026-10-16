import { describe, expect, it } from 'vitest';

import { isLang, PATH_WORDS, RESERVED_SLUGS } from './languages.js';

describe('languages (D10)', () => {
  it('reserves every page word of both languages, so no post hides behind a page in either', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([
      'about',
      'etiqueta',
      'sobre',
      'tag',
      'temas',
      'topics',
    ]);
    expect(PATH_WORDS.es.about).toBe('sobre');
  });

  it('knows its two languages and nothing else', () => {
    expect([isLang('es'), isLang('en'), isLang('fr'), isLang('ES'), isLang(undefined)]).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
