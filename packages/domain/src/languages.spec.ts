import { describe, expect, it } from 'vitest';

import { isLang, PATH_WORDS, RESERVED_SLUGS } from './languages.js';

describe('languages (D10)', () => {
  it('reserves every page word of both languages, so no post hides behind a page in either', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([
      'about',
      'buscar',
      'en',
      'es',
      'etiqueta',
      'healthz',
      'img',
      'og',
      'search',
      'sobre',
      'tag',
      'temas',
      'topics',
    ]);
    expect(PATH_WORDS.es.about).toBe('sobre');
    // The search page's words (R-WEB-18): `/buscar`, `/en/search`.
    expect([PATH_WORDS.es.search, PATH_WORDS.en.search]).toEqual(['buscar', 'search']);
  });

  it('reserves what shares the root with Spanish posts: the language prefixes, the health check, the files', () => {
    // Spanish is at the root (D10): `/en` is English's home, `/es` redirects to `/`, `/healthz` is the probe's, and
    // `/img/…` and `/og/…` serve the images and the share cards (D17).
    expect(['en', 'es', 'healthz', 'img', 'og'].every((word) => RESERVED_SLUGS.has(word))).toBe(
      true,
    );
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
