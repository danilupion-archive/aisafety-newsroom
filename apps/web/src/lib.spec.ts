import { describe, expect, it } from 'vitest';

import type { PostSummary } from './api';

import nextConfig from '../next.config.js';
import { splitWordmark } from './brand';
import { atomFeed, xml } from './feed';
import { calendarDate, dateParts, longDate } from './format';
import { otherLanguageHref, PATHNAME_HEADER, paths, readPath, route } from './i18n';
import { nextPage, readCursor } from './paging';
import { contentSecurityPolicy, gonePage } from './security';
import { readSite } from './site';
import { STRINGS } from './strings';
import { namedTags, tagLabel } from './tags';

const POST: PostSummary = {
  lang: 'es',
  slug: 'informe-de-ejemplo',
  type: 'breve',
  title: 'Un informe "de ejemplo" & <otro>',
  summary: 'Resumen de ejemplo.',
  tags: ['labs', 'evals'],
  published_at: '2026-10-15T08:00:00.000Z',
  updated_at: '2026-10-15T09:30:00.000Z',
};

describe('readSite', () => {
  it('reads the site from configuration, its name in each language, without trailing slashes', () => {
    expect(
      readSite({
        SITE_URL: 'https://newsroom.example/',
        SITE_NAME_ES: 'Noticias de ejemplo',
        SITE_NAME_EN: 'Example news',
        AUTHOR_NAME: 'Autora de ejemplo',
        API_URL: 'http://api:3001/',
        PLAUSIBLE_SCRIPT_URL: 'https://plausible.example/js/script.js',
        PLAUSIBLE_DOMAIN: 'newsroom.example',
      }),
    ).toEqual({
      url: 'https://newsroom.example',
      name: { es: 'Noticias de ejemplo', en: 'Example news' },
      author: 'Autora de ejemplo',
      apiUrl: 'http://api:3001',
      analytics: {
        scriptUrl: 'https://plausible.example/js/script.js',
        domain: 'newsroom.example',
      },
    });
  });

  it('turns analytics on only with both its settings', () => {
    expect(
      readSite({ PLAUSIBLE_SCRIPT_URL: 'https://plausible.example/js/script.js' }).analytics,
    ).toBeUndefined();
  });
});

describe('languages (D10)', () => {
  it('builds Spanish addresses at the root and English ones under /en, each in its own words', () => {
    expect([paths.home('es'), paths.home('en')]).toEqual(['/', '/en']);
    expect([paths.post('es', 'informe'), paths.post('en', 'report')]).toEqual([
      '/informe',
      '/en/report',
    ]);
    expect(paths.tag('es', 'evals')).toBe('/etiqueta/evals');
    expect(paths.tag('en', 'evals')).toBe('/en/tag/evals');
    expect([paths.topics('es'), paths.topics('en')]).toEqual(['/temas', '/en/topics']);
    expect([paths.about('es'), paths.about('en')]).toEqual(['/sobre', '/en/about']);
    expect([paths.feed('es'), paths.feed('en')]).toEqual(['/feed.xml', '/en/feed.xml']);
  });

  it('reads a public address’s language and the rest of its path', () => {
    expect(readPath('/')).toEqual({ lang: 'es', segments: [] });
    expect(readPath('/etiqueta/evals')).toEqual({ lang: 'es', segments: ['etiqueta', 'evals'] });
    expect(readPath('/en')).toEqual({ lang: 'en', segments: [] });
    expect(readPath('/en/')).toEqual({ lang: 'en', segments: [] });
    expect(readPath('/en/report')).toEqual({ lang: 'en', segments: ['report'] });
    // /es… is no Spanish page: the proxy sends it to the address without the prefix.
    expect(readPath('/es/informe')).toBeUndefined();
    expect(readPath(undefined)).toEqual({ lang: 'es', segments: [] });
  });

  it('names every tag in both languages', () => {
    expect(namedTags('en')).toEqual(namedTags('es'));
    expect(tagLabel('es', 'eu-regulation')).toBe('regulación europea');
    expect(tagLabel('en', 'eu-regulation')).toBe('EU regulation');
    expect(tagLabel('en', 'a-new-tag')).toBe('a-new-tag');
  });

  it('labels the link to each language in that language', () => {
    expect([STRINGS.es.name, STRINGS.en.name]).toEqual(['Español', 'English']);
    expect(STRINGS.en.readIn).toBe('Read it in English');
  });
});

describe('the proxy’s routes (D10, AC-11)', () => {
  it('serves Spanish at the root, from the Spanish pages inside', () => {
    expect(route('/')).toEqual({ kind: 'page', internal: '/es', post: undefined });
    expect(route('/temas')).toMatchObject({ kind: 'page', internal: '/es/temas' });
    expect(route('/feed.xml')).toEqual({ kind: 'page', internal: '/es/feed.xml', post: undefined });
    expect(route('/etiqueta/evals')).toEqual({
      kind: 'page',
      internal: '/es/etiqueta/evals',
      post: undefined,
    });
  });

  it('serves English as it is', () => {
    expect(route('/en')).toEqual({ kind: 'page', internal: '/en', post: undefined });
    expect(route('/en/topics')).toMatchObject({ kind: 'page', internal: '/en/topics' });
  });

  it('knows a post’s address in either language, for the 410 of an unpublished one', () => {
    expect(route('/informe-de-ejemplo')).toEqual({
      kind: 'page',
      internal: '/es/informe-de-ejemplo',
      post: { lang: 'es', slug: 'informe-de-ejemplo' },
    });
    expect(route('/en/example-report')).toMatchObject({
      post: { lang: 'en', slug: 'example-report' },
    });
    // The about page is a post too; anything that is no slug, or deeper, is none.
    expect(route('/sobre')).toMatchObject({ post: { lang: 'es', slug: 'sobre' } });
    expect(route('/Not-A-Slug')).toMatchObject({ post: undefined });
    expect(route('/etiqueta/evals')).toMatchObject({ post: undefined });
    expect(route('/en')).toMatchObject({ post: undefined });
  });

  it('serves /es… as it is: only its own rewrite brings the proxy there', () => {
    // Next may run the proxy again on the address it rewrote to; a reader's request for one never gets here (next.config).
    expect(route('/es')).toEqual({ kind: 'internal' });
    expect(route('/es/temas')).toEqual({ kind: 'internal' });
    // /escuela is a Spanish address, not /es's.
    expect(route('/escuela')).toMatchObject({ kind: 'page', internal: '/es/escuela' });
  });

  it('sends /es and everything under it to the same address without the prefix, before the proxy', async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    // Not the proxy's own rewrite, which Next may fetch as a request of its own: it carries the public path.
    const missing = [{ type: 'header', key: PATHNAME_HEADER }];
    expect(rules).toEqual([
      { source: '/es', destination: '/', statusCode: 301, missing },
      { source: '/es/:path*', destination: '/:path*', statusCode: 301, missing },
    ]);
  });

  it('leaves the site’s own files alone', () => {
    for (const file of [
      '/healthz',
      '/sitemap.xml',
      '/robots.txt',
      '/icon.svg',
      '/_next/data/x.json',
    ]) {
      expect(route(file)).toEqual({ kind: 'file' });
    }
  });
});

describe('dates (R-WEB-4)', () => {
  it('writes them in each language, in Madrid’s time', () => {
    expect(longDate('es', '2026-10-15T22:30:00Z')).toBe('16 de octubre de 2026');
    expect(longDate('en', '2026-10-15T22:30:00Z')).toBe('16 October 2026');
  });

  it('keeps a date-only value on its own calendar day', () => {
    expect(calendarDate('es', '2026-10-15')).toBe('15 de octubre de 2026');
    expect(calendarDate('en', '2026-10-15')).toBe('15 October 2026');
  });
});

describe('atomFeed', () => {
  const feed = atomFeed(
    'es',
    { url: 'https://newsroom.example', name: 'Noticias & más', author: 'Autora' },
    [POST],
  );

  it('lists each post with its link in its language, dates, tags and summary', () => {
    expect(feed).toContain('xml:lang="es"');
    expect(feed).toContain(
      '<link rel="alternate" type="text/html" href="https://newsroom.example/informe-de-ejemplo"/>',
    );
    expect(feed).toContain(
      '<link rel="self" type="application/atom+xml" href="https://newsroom.example/feed.xml"/>',
    );
    expect(feed).toContain('<published>2026-10-15T08:00:00.000Z</published>');
    expect(feed).toContain('<category term="evals"/>');
    expect(feed).toContain('<summary>Resumen de ejemplo.</summary>');
    expect(feed).toContain('<updated>2026-10-15T09:30:00.000Z</updated>');
  });

  it('escapes what XML gives meaning', () => {
    expect(feed).toContain('<title>Un informe &quot;de ejemplo&quot; &amp; &lt;otro&gt;</title>');
    expect(feed).toContain('<title>Noticias &amp; más</title>');
    expect(xml(`<a href='x'>`)).toBe('&lt;a href=&apos;x&apos;&gt;');
  });

  it('is still a valid feed with nothing in it', () => {
    const empty = atomFeed('en', { url: 'https://n.example', name: 'N', author: 'A' }, []);
    expect(empty).toContain('<updated>1970-01-01T00:00:00.000Z</updated>');
    expect(empty).toContain('<id>https://n.example/en</id>');
  });
});

describe('contentSecurityPolicy', () => {
  it('loads nothing from another host without analytics', () => {
    const policy = contentSecurityPolicy(undefined);
    expect(policy).toContain("script-src 'self' 'unsafe-inline';");
    expect(policy).toContain("connect-src 'self';");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-eval');
  });

  it('allows Plausible’s origin alone when it is configured (R-WEB-7)', () => {
    const policy = contentSecurityPolicy('https://plausible.example/js/script.js');
    expect(policy).toContain("script-src 'self' 'unsafe-inline' https://plausible.example;");
    expect(policy).toContain("connect-src 'self' https://plausible.example;");
  });
});

describe('the proxy’s own pages', () => {
  it('says a post was withdrawn in its language, kept out of search engines (AC-7)', () => {
    const page = gonePage('es', 'Noticias <de ejemplo>');
    expect(page).toContain('<html lang="es">');
    expect(page).toContain('Esta publicación se ha retirado');
    expect(page).toContain('name="robots" content="noindex"');
    expect(page).toContain('Noticias &lt;de ejemplo&gt;');
    expect(page).toContain('<a href="/">');
    const english = gonePage('en', 'Example news');
    expect(english).toContain('This post has been withdrawn');
    expect(english).toContain('<a href="/en">Back to Example news</a>');
  });
});

describe('paging', () => {
  it('reads the cursor the API gives out under each language’s names, and nothing else', () => {
    expect(
      readCursor('es', { antes: '2026-10-15T08:00:00.000Z', tras: 'informe-de-ejemplo' }),
    ).toEqual({
      before: '2026-10-15T08:00:00.000Z',
      beforeSlug: 'informe-de-ejemplo',
    });
    expect(readCursor('en', { before: '2026-10-15T08:00:00Z', after: 'example-report' })).toEqual({
      before: '2026-10-15T08:00:00Z',
      beforeSlug: 'example-report',
    });
    // The other language's names are no cursor.
    expect(readCursor('en', { antes: '2026-10-15T08:00:00.000Z' })).toBeUndefined();
    // A year past 9999 that Date.parse takes but the API refuses; a date with no time; a list; a bad slug.
    expect(readCursor('es', { antes: '+275760-01-01T00:00:00.000Z' })).toBeUndefined();
    expect(readCursor('es', { antes: '2026-10-15' })).toBeUndefined();
    expect(readCursor('es', { antes: ['2026-10-15T08:00:00.000Z'] })).toBeUndefined();
    expect(
      readCursor('es', { antes: '2026-10-15T08:00:00.000Z', tras: '<script>' })?.beforeSlug,
    ).toBeUndefined();
    // Dates Date.parse rolls over, which the API refuses; a slug longer than the API takes.
    expect(readCursor('es', { antes: '2026-02-30T00:00:00Z' })).toBeUndefined();
    expect(readCursor('en', { before: '2026-04-31T00:00:00.000Z' })).toBeUndefined();
    expect(readCursor('es', { antes: '2026-10-15T24:00:00Z' })).toBeUndefined();
    expect(readCursor('es', { antes: '2026-10-15T08:00:00.5Z' })?.before).toBe(
      '2026-10-15T08:00:00.5Z',
    );
    expect(
      readCursor('es', { antes: '2026-10-15T08:00:00Z', tras: 'a'.repeat(121) })?.beforeSlug,
    ).toBeUndefined();
  });

  it('links the next page from the last post shown', () => {
    expect(nextPage('es', '/etiqueta/evals', POST)).toBe(
      '/etiqueta/evals?antes=2026-10-15T08%3A00%3A00.000Z&tras=informe-de-ejemplo',
    );
    expect(nextPage('es', '/', POST)).toBe(
      '/?antes=2026-10-15T08%3A00%3A00.000Z&tras=informe-de-ejemplo',
    );
    expect(nextPage('en', '/en', { ...POST, slug: 'example' })).toBe(
      '/en?before=2026-10-15T08%3A00%3A00.000Z&after=example',
    );
  });
});

describe('the wordmark', () => {
  it('sets a name’s trailing IA apart, for the accent colour', () => {
    expect(splitWordmark('PandorIA')).toEqual({ lead: 'Pandor', ia: 'IA' });
  });

  it('leaves any other name whole', () => {
    expect(splitWordmark('Noticias de ejemplo')).toEqual({ lead: 'Noticias de ejemplo', ia: '' });
    expect(splitWordmark('Pandoria')).toEqual({ lead: 'Pandoria', ia: '' });
    // Nothing before the IA: the whole name, plain.
    expect(splitWordmark('IA')).toEqual({ lead: 'IA', ia: '' });
  });
});

describe('the timeline’s dates', () => {
  it('splits a date into its day, month, and weekday in each language, in Madrid’s time', () => {
    expect(dateParts('es', '2026-10-15T22:30:00Z')).toEqual({
      day: '16',
      month: 'OCT',
      weekday: 'viernes',
      weekdayShort: 'VIE',
    });
    expect(dateParts('en', '2026-10-15T22:30:00Z')).toEqual({
      day: '16',
      month: 'OCT',
      weekday: 'Friday',
      weekdayShort: 'FRI',
    });
    expect(dateParts('es', '2026-09-03T10:00:00Z').month).toBe('SEPT');
  });
});

describe('the link to the other language', () => {
  it('goes to the same page in the other language, in its words', () => {
    expect(otherLanguageHref('es', '/')).toBe('/en');
    expect(otherLanguageHref('en', '/en')).toBe('/');
    expect(otherLanguageHref('en', '/en/topics')).toBe('/temas');
    expect(otherLanguageHref('es', '/sobre')).toBe('/en/about');
    expect(otherLanguageHref('es', '/etiqueta/evals')).toBe('/en/tag/evals');
    expect(otherLanguageHref('en', '/en/tag/evals')).toBe('/etiqueta/evals');
  });

  it('goes to a post’s translation when it has one, and to the other home when it doesn’t', () => {
    expect(otherLanguageHref('es', '/informe', { lang: 'en', slug: 'report' })).toBe('/en/report');
    expect(otherLanguageHref('en', '/en/report', { lang: 'es', slug: 'informe' })).toBe('/informe');
    expect(otherLanguageHref('es', '/informe')).toBe('/en');
  });

  it('goes to the other home from anything else', () => {
    expect(otherLanguageHref('es', undefined)).toBe('/en');
    expect(otherLanguageHref('es', '/etiqueta/Not a tag')).toBe('/en');
    expect(otherLanguageHref('es', '/a/b/c')).toBe('/en');
    // Another language's path is no page of this one.
    expect(otherLanguageHref('es', '/en/topics')).toBe('/en');
    expect(otherLanguageHref('en', '/temas')).toBe('/');
  });
});

describe('a post’s sources, counted', () => {
  it('says one or many in each language', () => {
    expect([STRINGS.es.sourceCount(1), STRINGS.es.sourceCount(3)]).toEqual([
      '1 fuente',
      '3 fuentes',
    ]);
    expect([STRINGS.en.sourceCount(1), STRINGS.en.sourceCount(2)]).toEqual([
      '1 source',
      '2 sources',
    ]);
  });
});
