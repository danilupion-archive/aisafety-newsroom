import { describe, expect, it } from 'vitest';

import { isLang, PATH_WORDS, RESERVED_SLUGS } from './languages.js';

describe('languages (D10)', () => {
  it('reserves every page word of both languages, so no post hides behind a page in either', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([
      'about',
      'en',
      'es',
      'etiqueta',
      'healthz',
      'sobre',
      'tag',
      'temas',
      'topics',
    ]);
    expect(PATH_WORDS.es.about).toBe('sobre');
  });

  it('reserves what shares the root with Spanish posts: the language prefixes and the health check', () => {
    // Spanish is at the root (D10): `/en` is English's home, `/es` redirects to `/`, `/healthz` is the probe's.
    expect(['en', 'es', 'healthz'].every((word) => RESERVED_SLUGS.has(word))).toBe(true);
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
