import { describe, expect, it } from 'vitest';

import { AUTO_PAUSE, autoLoads, MAX_SHOWN, readShown, shownHref } from './continuous';
import { otherLanguageHref, paths, route } from './i18n';
import { cursorOf } from './paging';
import { readSearch, searchHref } from './search';

describe('search addresses (R-WEB-18)', () => {
  it('has a page in each language, in its own word', () => {
    expect([paths.search('es'), paths.search('en')]).toEqual(['/buscar', '/en/search']);
    expect(route('/buscar')).toMatchObject({
      kind: 'page',
      lang: 'es',
      internal: '/es/buscar',
      known: true,
    });
    expect(route('/en/search')).toMatchObject({ kind: 'page', lang: 'en', known: true });
  });

  it('switches language to the other search page', () => {
    expect(otherLanguageHref('es', '/buscar')).toBe('/en/search');
    expect(otherLanguageHref('en', '/en/search')).toBe('/buscar');
  });

  it('reads the words and where the page starts, in the page’s language', () => {
    expect(readSearch('es', { q: '  pérdida de control ', desde: '20' })).toEqual({
      q: 'pérdida de control',
      from: 20,
    });
    expect(readSearch('en', { q: 'loss', from: '40' })).toEqual({ q: 'loss', from: 40 });
    // Another language's word for the start, a negative or absurd start: the first page.
    expect(readSearch('es', { q: 'x', from: '20' }).from).toBe(0);
    expect(readSearch('es', { q: 'x', desde: '-5' }).from).toBe(0);
    expect(readSearch('es', { q: 'x', desde: '9999' }).from).toBe(0);
  });

  it('takes no search from nothing, control characters or a list, and cuts it at 100 characters', () => {
    expect(readSearch('es', {}).q).toBeUndefined();
    expect(readSearch('es', { q: '   ' }).q).toBeUndefined();
    expect(readSearch('es', { q: ['a', 'b'] }).q).toBeUndefined();
    expect(readSearch('es', { q: 'a\u0002b' }).q).toBe('a b');
    expect(readSearch('es', { q: 'x'.repeat(150) }).q).toHaveLength(100);
  });

  it('builds the address of a search and of its next page', () => {
    expect(searchHref('es', 'regulación')).toBe('/buscar?q=regulaci%C3%B3n');
    expect(searchHref('es', 'regulación', 20)).toBe('/buscar?q=regulaci%C3%B3n&desde=20');
    expect(searchHref('en', '"loss of control"', 40)).toBe(
      '/en/search?q=%22loss+of+control%22&from=40',
    );
  });
});

describe('the continuous timeline (R-WEB-19)', () => {
  it('loads on its own until 100 posts came that way, then waits for the reader', () => {
    const state = { autoLoaded: 0, more: true, loading: false, failed: false };
    expect(autoLoads(state)).toBe(true);
    expect(autoLoads({ ...state, autoLoaded: AUTO_PAUSE - 20 })).toBe(true);
    expect(autoLoads({ ...state, autoLoaded: AUTO_PAUSE })).toBe(false);
    expect(AUTO_PAUSE).toBe(100);
  });

  it('never loads with nothing more, while loading, or after a failure', () => {
    const state = { autoLoaded: 0, more: true, loading: false, failed: false };
    expect(autoLoads({ ...state, more: false })).toBe(false);
    expect(autoLoads({ ...state, loading: true })).toBe(false);
    expect(autoLoads({ ...state, failed: true })).toBe(false);
  });

  it('tracks how far the reader got in the address, bounded, in the page’s words', () => {
    expect(shownHref('es', '/', 'posted', 60)).toBe('/?mostrar=60');
    expect(shownHref('es', '/', 'news', 60)).toBe('/?orden=noticia&mostrar=60');
    expect(shownHref('en', '/en/tag/evals', 'posted', 40)).toBe('/en/tag/evals?show=40');
    expect(shownHref('es', '/', 'posted', 5000)).toBe(`/?mostrar=${MAX_SHOWN}`);
    expect(readShown('es', { mostrar: '60' })).toBe(60);
    expect(readShown('en', { show: '40' })).toBe(40);
    expect(readShown('es', { mostrar: '5000' })).toBe(MAX_SHOWN);
    expect(readShown('es', { show: '60' })).toBeUndefined();
    expect(readShown('es', { mostrar: '1.5' })).toBeUndefined();
    expect(readShown('es', { mostrar: '0' })).toBeUndefined();
  });
});

describe('cursorOf', () => {
  it('takes a cursor only in the shapes the API gives out, news order needing its day', () => {
    const at = '2026-10-15T08:00:00.000Z';
    expect(cursorOf({ before: at, beforeSlug: 'un-caso' }, 'posted')).toEqual({
      before: at,
      beforeSlug: 'un-caso',
    });
    expect(
      cursorOf({ before: at, beforeSlug: 'un-caso', beforeDate: '2026-10-14' }, 'news'),
    ).toEqual({
      before: at,
      beforeSlug: 'un-caso',
      beforeDate: '2026-10-14',
    });
    expect(cursorOf({ before: at }, 'news')).toBeUndefined();
    expect(cursorOf({ before: 'ayer' }, 'posted')).toBeUndefined();
    expect(cursorOf({ before: at, beforeSlug: 'No Slug' }, 'posted')).toEqual({
      before: at,
      beforeSlug: undefined,
    });
    expect(cursorOf('x', 'posted')).toBeUndefined();
  });
});
