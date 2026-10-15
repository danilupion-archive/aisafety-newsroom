import { describe, expect, it } from 'vitest';

import type { PostSummary } from './api';

import { atomFeed, xml } from './feed';
import { calendarDate, longDate } from './format';
import { nextPage, readCursor } from './paging';
import { contentSecurityPolicy, gonePage } from './security';
import { readSite } from './site';

const POST: PostSummary = {
  slug: 'informe-de-ejemplo',
  type: 'breve',
  title: 'Un informe "de ejemplo" & <otro>',
  summary: 'Resumen de ejemplo.',
  tags: ['labs', 'evals'],
  published_at: '2026-10-15T08:00:00.000Z',
  updated_at: '2026-10-15T09:30:00.000Z',
};

describe('readSite', () => {
  it('reads the site from configuration, without trailing slashes', () => {
    expect(
      readSite({
        SITE_URL: 'https://newsroom.example/',
        SITE_NAME: 'Noticias de ejemplo',
        AUTHOR_NAME: 'Autora de ejemplo',
        API_URL: 'http://api:3001/',
        PLAUSIBLE_SCRIPT_URL: 'https://plausible.example/js/script.js',
        PLAUSIBLE_DOMAIN: 'newsroom.example',
      }),
    ).toEqual({
      url: 'https://newsroom.example',
      name: 'Noticias de ejemplo',
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

describe('dates (R-WEB-4)', () => {
  it('writes them in Spanish, in Madrid’s time', () => {
    expect(longDate('2026-10-15T22:30:00Z')).toBe('16 de octubre de 2026');
  });

  it('keeps a date-only value on its own calendar day', () => {
    expect(calendarDate('2026-10-15')).toBe('15 de octubre de 2026');
  });
});

describe('atomFeed', () => {
  const feed = atomFeed(
    { url: 'https://newsroom.example', name: 'Noticias & más', author: 'Autora' },
    [POST],
  );

  it('lists each post with its link, dates, tags and summary', () => {
    expect(feed).toContain(
      '<link rel="alternate" type="text/html" href="https://newsroom.example/informe-de-ejemplo"/>',
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
    expect(atomFeed({ url: 'https://n.example', name: 'N', author: 'A' }, [])).toContain(
      '<updated>1970-01-01T00:00:00.000Z</updated>',
    );
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

describe('gonePage (AC-7)', () => {
  it('says the post was withdrawn, in Spanish, kept out of search engines', () => {
    const page = gonePage('Noticias <de ejemplo>');
    expect(page).toContain('Esta publicación se ha retirado');
    expect(page).toContain('name="robots" content="noindex"');
    expect(page).toContain('Noticias &lt;de ejemplo&gt;');
  });
});

describe('paging', () => {
  it('reads the cursor the API gives out, and nothing else', () => {
    expect(readCursor('2026-10-15T08:00:00.000Z', 'informe-de-ejemplo')).toEqual({
      before: '2026-10-15T08:00:00.000Z',
      beforeSlug: 'informe-de-ejemplo',
    });
    expect(readCursor('2026-10-15T08:00:00Z', undefined)).toEqual({
      before: '2026-10-15T08:00:00Z',
      beforeSlug: undefined,
    });
    // A year past 9999 that Date.parse takes but the API refuses; a date with no time; a list; a bad slug.
    expect(readCursor('+275760-01-01T00:00:00.000Z', undefined)).toBeUndefined();
    expect(readCursor('2026-10-15', undefined)).toBeUndefined();
    expect(readCursor(['2026-10-15T08:00:00.000Z'], undefined)).toBeUndefined();
    expect(readCursor('2026-10-15T08:00:00.000Z', '<script>')?.beforeSlug).toBeUndefined();
  });

  it('links the next page from the last post shown', () => {
    expect(nextPage('/etiqueta/evals', POST)).toBe(
      '/etiqueta/evals?antes=2026-10-15T08%3A00%3A00.000Z&tras=informe-de-ejemplo',
    );
  });
});
