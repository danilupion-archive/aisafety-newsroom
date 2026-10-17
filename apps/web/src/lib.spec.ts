import { runInNewContext } from 'node:vm';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PostSummary } from './api';

import nextConfig from '../next.config.js';
import { splitWordmark } from './brand';
import { bylineOf } from './byline';
import { Mark } from './components/Mark';
import { QuoteCard } from './components/QuoteCard';
import { atomFeed, xml } from './feed';
import { calendarDate, calendarParts, dateParts, longDate, madridDay, newsNote } from './format';
import { missingPage, otherLanguageHref, PATHNAME_HEADER, paths, readPath, route } from './i18n';
import { cardImage, IMAGE_CACHE, imagePath, readImagePath } from './images';
import { cardTitle } from './og/title';
import { nextPage, orderHref, readCursor, readOrder } from './paging';
import { ACCENT_SOFT, COLORS, contrast } from './palette';
import { platformOf } from './quotes';
import { contentSecurityPolicy, gonePage } from './security';
import { PLAUSIBLE_INIT, readSite } from './site';
import { STRINGS } from './strings';
import { namedTags, tagLabel } from './tags';
import { videoOf, youtubeEmbed } from './video';

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
        AUTHOR_URL: 'https://autora.example/',
        API_URL: 'http://api:3001/',
        PLAUSIBLE_SCRIPT_URL: 'https://plausible.example/js/pa-example.js',
      }),
    ).toEqual({
      url: 'https://newsroom.example',
      name: { es: 'Noticias de ejemplo', en: 'Example news' },
      author: 'Autora de ejemplo',
      authorUrl: 'https://autora.example/',
      apiUrl: 'http://api:3001',
      analytics: { scriptUrl: 'https://plausible.example/js/pa-example.js' },
    });
  });

  it('links the editor’s name only when configuration gives a page for it', () => {
    expect(readSite({}).authorUrl).toBeUndefined();
    expect(readSite({ AUTHOR_URL: '' }).authorUrl).toBeUndefined();
  });

  it('turns analytics on with the site’s script alone, and off without it', () => {
    expect(readSite({ PLAUSIBLE_DOMAIN: 'newsroom.example' }).analytics).toBeUndefined();
    expect(readSite({ PLAUSIBLE_SCRIPT_URL: '' }).analytics).toBeUndefined();
  });

  it('starts Plausible as its snippet does: calls wait in a queue until the script arrives', () => {
    const context: Record<string, unknown> = {};
    context.window = context;
    runInNewContext(PLAUSIBLE_INIT, context);
    const plausible = context.plausible as ((...args: unknown[]) => void) & {
      q?: unknown[];
      o?: object;
    };
    expect(Object.keys(plausible.o ?? { unset: true })).toEqual([]);
    plausible('pageview');
    expect(plausible.q).toHaveLength(1);
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
    expect(tagLabel('es', 'self-improvement')).toBe('automejora recursiva');
    expect(tagLabel('en', 'self-improvement')).toBe('recursive self-improvement');
    expect(tagLabel('en', 'a-new-tag')).toBe('a-new-tag');
  });

  it('labels the link to each language in that language', () => {
    expect([STRINGS.es.name, STRINGS.en.name]).toEqual(['Español', 'English']);
    expect(STRINGS.en.readIn).toBe('Read it in English');
  });
});

describe('the proxy’s routes (D10, AC-11)', () => {
  it('serves Spanish at the root, from the Spanish pages inside', () => {
    expect(route('/')).toEqual({
      kind: 'page',
      lang: 'es',
      internal: '/es',
      post: undefined,
      tag: undefined,
      known: true,
    });
    expect(route('/temas')).toMatchObject({ kind: 'page', internal: '/es/temas', known: true });
    expect(route('/feed.xml')).toMatchObject({
      internal: '/es/feed.xml',
      post: undefined,
      known: true,
    });
    expect(route('/etiqueta/evals')).toEqual({
      kind: 'page',
      lang: 'es',
      internal: '/es/etiqueta/evals',
      post: undefined,
      tag: 'evals',
      known: true,
    });
  });

  it('serves English as it is', () => {
    expect(route('/en')).toMatchObject({ kind: 'page', lang: 'en', internal: '/en', known: true });
    expect(route('/en/topics')).toMatchObject({ kind: 'page', internal: '/en/topics' });
  });

  it('knows a post’s address in either language, for the 410 of an unpublished one', () => {
    expect(route('/informe-de-ejemplo')).toEqual({
      kind: 'page',
      lang: 'es',
      internal: '/es/informe-de-ejemplo',
      post: { lang: 'es', slug: 'informe-de-ejemplo' },
      tag: undefined,
      known: true,
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

  it('knows which addresses can’t be a page at all, to answer them as missing (404) without asking the API', () => {
    for (const address of [
      '/a/b/c',
      '/Not-A-Slug',
      '/en/etiqueta/evals',
      '/etiqueta',
      '/etiqueta/Evals',
      '/en/tag/a/b',
    ]) {
      expect(route(address), address).toMatchObject({ kind: 'page', known: false });
    }
    // The other language's words are slugs in shape: only the API can say no post has them.
    expect(route('/topics')).toMatchObject({ known: true, post: { lang: 'es', slug: 'topics' } });
    expect(route('/en/tag/evals')).toMatchObject({ known: true, tag: 'evals' });
  });

  it('serves a missing address the not-found page of its language, from inside', () => {
    expect(missingPage('es')).toBe('/es/missing.html');
    expect(missingPage('en')).toBe('/en/missing.html');
    // Never a post's address: a slug has no dot.
    expect(route('/missing.html')).toMatchObject({ known: false, post: undefined });
  });

  it('serves /es… as it is: only its own rewrite brings the proxy there', () => {
    // Next may run the proxy again on the address it rewrote to; a reader's request for one never gets here (next.config).
    expect(route('/es')).toEqual({ kind: 'internal' });
    expect(route('/es/temas')).toEqual({ kind: 'internal' });
    // /escuela is a Spanish address, not /es's.
    expect(route('/escuela')).toMatchObject({ kind: 'page', internal: '/es/escuela', known: true });
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
      '/apple-icon.png',
      '/_next/data/x.json',
      // The images and the share cards (D17, R-WEB-14): never a Spanish page, never waiting on the API in the proxy.
      `/img/lead/${'a'.repeat(64)}.webp`,
      '/og/es.png',
      '/og/en/example-report.png',
    ]) {
      expect(route(file)).toEqual({ kind: 'file' });
    }
  });
});

const SHA = 'f'.repeat(64);

describe('bylineOf (R-WEB-3, D19)', () => {
  it('reads a post as AI-written, a person’s, or an AI translation of a person’s', () => {
    expect(bylineOf({})).toEqual({ kind: 'ai' });
    expect(bylineOf({ author: null, original_author: null })).toEqual({ kind: 'ai' });
    expect(bylineOf({ author: 'Autora' })).toEqual({ kind: 'person', author: 'Autora' });
    expect(bylineOf({ author: null, original_author: 'Autora' })).toEqual({
      kind: 'translation',
      author: 'Autora',
    });
    // A translation its translator signed is theirs.
    expect(bylineOf({ author: 'Traductora', original_author: 'Autora' })).toEqual({
      kind: 'person',
      author: 'Traductora',
    });
  });
});

describe('quote cards (R-WEB-17, D21)', () => {
  it('names the platform from the address, never storing it', () => {
    expect(platformOf('https://x.com/ejemplo/status/1')).toBe('X');
    expect(platformOf('https://twitter.com/ejemplo/status/1')).toBe('X');
    expect(platformOf('https://mobile.twitter.com/ejemplo/status/1')).toBe('X');
    expect(platformOf('https://bsky.app/profile/example.org/post/3abc')).toBe('Bluesky');
    expect(platformOf('https://www.linkedin.com/posts/ejemplo-1')).toBe('LinkedIn');
    expect(platformOf('https://mastodon.example/@ejemplo/112233445566')).toBe('Mastodon');
    expect(platformOf('https://www.example.org/blog/una-entrada')).toBe('example.org');
  });

  it('draws the quotation as text with its author, platform, date and a link to the original, loading nothing', () => {
    const html = renderToStaticMarkup(
      createElement(QuoteCard, {
        lang: 'es',
        quote: {
          text: 'An example sentence.',
          author: 'Persona de Ejemplo',
          handle: '@ejemplo',
          url: 'https://x.com/ejemplo/status/1',
          date: '2026-10-16',
          translation: 'Una frase de ejemplo.',
        },
      }),
    );
    expect(html).toContain('<blockquote cite="https://x.com/ejemplo/status/1"');
    expect(html).toContain('An example sentence.');
    expect(html).toContain('Persona de Ejemplo');
    expect(html).toContain('@ejemplo');
    expect(html).toContain('16 de octubre de 2026');
    expect(html).toContain('Ver en X');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Traducción nuestra');
    expect(html).toContain('Una frase de ejemplo.');
    expect(html).not.toMatch(/<img|<iframe|<script/);
  });

  it('says nothing of a translation when there is none', () => {
    const html = renderToStaticMarkup(
      createElement(QuoteCard, {
        lang: 'en',
        quote: {
          text: 'Another example.',
          author: 'Otra Persona',
          url: 'https://bsky.app/profile/example.org/post/3abc',
          date: '2026-10-15',
        },
      }),
    );
    expect(html).toContain('View on Bluesky');
    expect(html).not.toContain('Our translation');
  });
});

describe('images (D17)', () => {
  it('illustrates a card with its lead image, else its first source preview with the outlet’s credit', () => {
    const lead = {
      sha256: SHA,
      alt: 'Un gráfico',
      credit: 'Autora',
      licence: 'CC BY 4.0',
      source_url: 'https://example.org',
      width: 1600,
      height: 900,
    };
    const preview = { sha256: 'e'.repeat(64), credit: 'example.org' };
    expect(cardImage({ image: lead, preview })).toEqual({
      src: imagePath('lead', SHA),
      thumbSrc: imagePath('lead', SHA, 'thumb'),
    });
    expect(cardImage({ image: null, preview })).toEqual({
      src: imagePath('preview', preview.sha256),
      thumbSrc: imagePath('preview', preview.sha256, 'thumb'),
      credit: 'example.org',
    });
    expect(cardImage({ image: null, preview: null })).toBeUndefined();
    expect(
      cardImage({
        image: null,
        preview: { ...preview, source_url: 'https://youtu.be/dQw4w9WgXcQ?si=x' },
      }),
    ).toEqual({
      src: imagePath('preview', preview.sha256),
      thumbSrc: imagePath('preview', preview.sha256, 'thumb'),
      credit: 'example.org',
      video: 'dQw4w9WgXcQ',
    });
    expect(youtubeEmbed('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    );
    expect(videoOf('https://example.org/video')).toBeUndefined();
    expect(cardImage({})).toBeUndefined();
  });

  it('names each image by kind and SHA-256, full or thumbnail, and reads nothing else', () => {
    expect(imagePath('lead', SHA)).toBe(`/img/lead/${SHA}.webp`);
    expect(imagePath('preview', SHA, 'thumb')).toBe(`/img/preview/${SHA}.thumb.webp`);
    expect(readImagePath('lead', `${SHA}.webp`)).toEqual({
      kind: 'lead',
      sha256: SHA,
      size: 'full',
    });
    expect(readImagePath('preview', `${SHA}.thumb.webp`)).toEqual({
      kind: 'preview',
      sha256: SHA,
      size: 'thumb',
    });
    for (const [kind, file] of [
      ['other', `${SHA}.webp`],
      ['lead', `${SHA}.png`],
      ['lead', `${SHA.toUpperCase()}.webp`],
      ['lead', '../etc/passwd'],
      ['lead', `${SHA}.thumb.thumb.webp`],
    ] as const) {
      expect(readImagePath(kind, file)).toBeUndefined();
    }
  });

  it('lets browsers keep a file: its name changes whenever its bytes would', () => {
    expect(IMAGE_CACHE).toBe('public, max-age=604800, immutable');
  });
});

describe('share cards (R-WEB-14)', () => {
  it('has one per language’s home and one per post', () => {
    expect(paths.shareCard('es')).toBe('/og/es.png');
    expect(paths.shareCard('en', 'example-report')).toBe('/og/en/example-report.png');
  });

  it('sets a title smaller the longer it is, and cuts one past any title’s length at a word', () => {
    expect(cardTitle('Un título corto').size).toBe(80);
    expect(cardTitle('x'.repeat(70)).size).toBe(66);
    expect(cardTitle('palabra '.repeat(14)).size).toBe(54);
    const long = cardTitle('palabra '.repeat(40));
    expect(long.size).toBe(48);
    expect(long.text.endsWith('palabra…')).toBe(true);
    expect(long.text.length).toBeLessThanOrEqual(161);
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

  it('gives an instant’s day on the site’s clock', () => {
    expect(madridDay('2026-10-15T22:30:00Z')).toBe('2026-10-16');
    expect(madridDay('2026-10-15T21:30:00Z')).toBe('2026-10-15');
  });

  it('says a post’s news date only when its story happened on another day than it was posted (R-WEB-13)', () => {
    const posted = { published_at: '2026-10-15T22:30:00Z' };
    expect(newsNote('es', { ...posted, news_date: '2026-10-12' })).toBe('noticia del 12 oct');
    expect(newsNote('en', { ...posted, news_date: '2026-10-12' })).toBe('news from 12 Oct');
    // Another year says so.
    expect(newsNote('es', { ...posted, news_date: '2025-12-30' })).toBe('noticia del 30 dic 2025');
    // Posted the day it happened, on Madrid's clock; or no news date (an older API).
    expect(newsNote('es', { ...posted, news_date: '2026-10-16' })).toBeUndefined();
    expect(newsNote('es', posted)).toBeUndefined();
    expect(newsNote('en', { ...posted, news_date: null })).toBeUndefined();
    // On a post's page, in full.
    expect(newsNote('es', { ...posted, news_date: '2026-10-12' }, 'long')).toBe(
      'noticia del 12 de octubre de 2026',
    );
  });
});

describe('atomFeed', () => {
  const feed = atomFeed(
    'es',
    {
      url: 'https://newsroom.example',
      name: 'Noticias & más',
      author: 'Autora',
      authorUrl: 'https://autora.example/',
    },
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
    expect(feed).toContain(
      '<summary>Resumen de ejemplo.\n\nTexto escrito por IA a partir de las fuentes enlazadas y elegido por Autora.</summary>',
    );
    expect(feed).toContain('<updated>2026-10-15T09:30:00.000Z</updated>');
  });

  it('escapes what XML gives meaning', () => {
    expect(feed).toContain('<title>Un informe &quot;de ejemplo&quot; &amp; &lt;otro&gt;</title>');
    expect(feed).toContain('<title>Noticias &amp; más</title>');
    expect(xml(`<a href='x'>`)).toBe('&lt;a href=&apos;x&apos;&gt;');
  });

  it('says in every entry that its text is AI-written from its sources, and who picked it (R-WEB-3)', () => {
    const bare = atomFeed('en', { url: 'https://n.example', name: 'N', author: 'A' }, [
      { ...POST, summary: '' },
    ]);
    expect(bare).toContain(
      '<summary>Written by AI from the linked sources and picked by A.</summary>',
    );
    // Nothing claims a check that isn't always made (D19).
    expect(bare).not.toMatch(/checked/);
  });

  it('credits a signed entry to its writer, and says when a signed text was translated with AI (D19)', () => {
    const site = { url: 'https://n.example', name: 'N', author: 'A' };
    const signed = atomFeed('es', site, [{ ...POST, summary: '', author: 'Autora de Ejemplo' }]);
    expect(signed).toContain('<summary>Escrito por Autora de Ejemplo.</summary>');
    const translated = atomFeed('en', site, [
      { ...POST, summary: '', original_author: 'Autora de Ejemplo' },
    ]);
    expect(translated).toContain(
      '<summary>Written by Autora de Ejemplo; translated with AI.</summary>',
    );
  });

  it('states the texts’ licence (D14)', () => {
    expect(feed).toContain(
      '<rights>CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/deed.es</rights>',
    );
  });

  it('names the editor, with their page when there is one', () => {
    expect(feed).toContain(
      '<author><name>Autora</name><uri>https://autora.example/</uri></author>',
    );
    const plain = atomFeed('en', { url: 'https://n.example', name: 'N', author: 'A' }, []);
    expect(plain).toContain('<author><name>A</name></author>');
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

  it('lets only YouTube’s privacy-enhanced player into a frame (R-WEB-12)', () => {
    expect(contentSecurityPolicy(undefined)).toContain(
      'frame-src https://www.youtube-nocookie.com;',
    );
  });

  it('allows Plausible’s origin alone when it is configured (R-WEB-7)', () => {
    const policy = contentSecurityPolicy('https://plausible.example/js/pa-example.js');
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

  it('reads the order: as posted unless the query asks for the news date, in each language’s words (R-WEB-13)', () => {
    expect(readOrder('es', {})).toBe('posted');
    expect(readOrder('es', { orden: 'noticia' })).toBe('news');
    expect(readOrder('en', { order: 'news' })).toBe('news');
    expect(readOrder('en', { orden: 'noticia' })).toBe('posted');
    expect(readOrder('es', { orden: ['noticia'] })).toBe('posted');
    expect(orderHref('es', '/', 'posted')).toBe('/');
    expect(orderHref('es', '/', 'news')).toBe('/?orden=noticia');
    expect(orderHref('en', '/en/tag/evals', 'news')).toBe('/en/tag/evals?order=news');
  });

  it('pages in news order from the last post’s news date, then its instant and slug', () => {
    const query = {
      orden: 'noticia',
      dia: '2026-10-12',
      antes: '2026-10-15T08:00:00.000Z',
      tras: 'x',
    };
    expect(readCursor('es', query, 'news')).toEqual({
      before: '2026-10-15T08:00:00.000Z',
      beforeSlug: 'x',
      beforeDate: '2026-10-12',
    });
    // Without a real day there's no news-order cursor; as posted, the day is ignored.
    expect(readCursor('es', { ...query, dia: '2026-02-30' }, 'news')).toBeUndefined();
    expect(readCursor('es', { ...query, dia: undefined }, 'news')).toBeUndefined();
    expect(readCursor('es', query)).toEqual({
      before: '2026-10-15T08:00:00.000Z',
      beforeSlug: 'x',
    });
    expect(nextPage('es', '/', { ...POST, news_date: '2026-10-12' }, 'news')).toBe(
      '/?orden=noticia&antes=2026-10-15T08%3A00%3A00.000Z&tras=informe-de-ejemplo&dia=2026-10-12',
    );
    expect(
      nextPage('en', '/en', { ...POST, slug: 'example', news_date: '2026-10-12' }, 'news'),
    ).toBe('/en?order=news&before=2026-10-15T08%3A00%3A00.000Z&after=example&day=2026-10-12');
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

  it('splits a news date into the same parts, on its own calendar day', () => {
    expect(calendarParts('es', '2026-10-16')).toEqual({
      day: '16',
      month: 'OCT',
      weekday: 'viernes',
      weekdayShort: 'VIE',
    });
    expect(calendarParts('en', '2026-01-01').weekday).toBe('Thursday');
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

describe('the palette (R-WEB-11)', () => {
  /** A colour at some opacity over another, as the eye sees it: a tag's fill. */
  const over = (rgba: string, ground: string): string => {
    const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
    const mix = (value: number, at: number) =>
      Math.round(value * a + Number.parseInt(ground.slice(at, at + 2), 16) * (1 - a));
    return `#${[mix(r, 1), mix(g, 3), mix(b, 5)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  it('measures contrast as WCAG 2.2 does', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
  });

  it('keeps every text colour readable on every ground it sits on (AA, 4.5:1)', () => {
    const { page, card, deep, text, body, muted, accent, highlight } = COLORS;
    const pairs: [string, string][] = [
      [text, page],
      [text, card],
      [text, deep],
      [body, page],
      [body, card],
      [muted, page],
      [muted, card],
      [muted, deep],
      // Aquamarine, the workhorse: links, dates, tags (on their fill too), and navy text on its buttons and switches.
      [accent, page],
      [accent, card],
      [accent, deep],
      [accent, over(ACCENT_SOFT, card)],
      [page, accent],
      // Navy on the pink of the play button.
      [page, highlight],
    ];
    for (const [fg, ground] of pairs) {
      expect(contrast(fg, ground), `${fg} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the pink a highlight that stands out, never small text', () => {
    expect(contrast(COLORS.highlight, COLORS.page)).toBeGreaterThanOrEqual(3);
    expect(contrast(COLORS.highlight, COLORS.card)).toBeGreaterThanOrEqual(3);
  });
});

describe('Mark', () => {
  it('gives each mark its own filter and gradient ids, so two on a page don’t borrow each other’s', () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(Mark, { size: 46 }),
        createElement(Mark, { size: 46 }),
      ),
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBe(10);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) {
      expect(html).toContain(`url(#${id})`);
    }
  });

  it('draws only the rising tentacle when it’s too small for the rest', () => {
    const small = renderToStaticMarkup(createElement(Mark, { size: 24 }));
    const large = renderToStaticMarkup(createElement(Mark, { size: 46 }));
    expect(small.match(/<circle/g)).toBeNull();
    expect(large.match(/<circle/g)?.length).toBeGreaterThan(10);
  });
});
