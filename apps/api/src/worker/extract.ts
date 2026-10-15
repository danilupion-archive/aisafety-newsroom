import { Readability } from '@mozilla/readability';
import htmlEncodingSniffer from 'html-encoding-sniffer';
import { JSDOM } from 'jsdom';
import { isUtf8 } from 'node:buffer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * A fetched page's main text and metadata (R-FET-2), with aiontheballot's extraction (its ADR-0003 §9): Readability on
 * jsdom for web pages, PDF.js for PDFs. The bytes are untrusted: jsdom runs no script and loads nothing, PDF.js runs
 * without forms, fonts or fetches. What comes out is stored as text and rendered nowhere public (R-FET-6).
 */

/** The database's limit on `page_text` (SPEC §7, `[Q9]`). */
export const PAGE_TEXT_MAX = 20_000;

export interface Extracted {
  /** From the page's own metadata, verbatim. */
  title: string | null;
  siteName: string | null;
  /** As the page states it (`article:published_time`, `<time datetime>`), never reinterpreted. */
  publishedAt: string | null;
  /** The main text, at most PAGE_TEXT_MAX characters; null when there's none to read. */
  text: string | null;
}

const NOTHING: Extracted = { title: null, siteName: null, publishedAt: null, text: null };

/**
 * Text as stored: NUL, which Postgres can't hold, goes; the other control characters (but tabs and line breaks) become
 * spaces, as a reader sees them.
 */
const clean = (text: string): string =>
  text.replaceAll('\u0000', '').replace(/(?![\t\n\r])\p{Cc}/gu, ' ');

const capped = (text: string): string | null => {
  const tidy = clean(text)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (tidy === '') {
    return null;
  }
  return tidy.length > PAGE_TEXT_MAX ? tidy.slice(0, PAGE_TEXT_MAX) : tidy;
};

const oneLine = (value: string | null | undefined): string | null => {
  const tidy =
    value === null || value === undefined ? '' : clean(value).replace(/\s+/g, ' ').trim();
  return tidy === '' ? null : tidy;
};

const meta = (document: Document, selector: string): string | null =>
  oneLine(document.querySelector<HTMLMetaElement>(selector)?.content);

/** Elements whose text starts a paragraph of its own. */
const BLOCKS = new Set([
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
]);
const HIDDEN = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'SVG']);
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** The paragraphs of Readability's article, each once, in document order, separated by blank lines. */
const paragraphs = (body: Element): string => {
  const out: string[] = [];
  let current = '';
  const flush = () => {
    const text = current.replace(/\s+/g, ' ').trim();
    current = '';
    if (text !== '') {
      out.push(text);
    }
  };
  const visit = (node: Node) => {
    if (node.nodeType === TEXT_NODE) {
      current += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) {
      return;
    }
    const tag = (node as Element).tagName.toUpperCase();
    if (HIDDEN.has(tag)) {
      return;
    }
    const block = BLOCKS.has(tag);
    if (block) {
      flush();
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
    if (block) {
      flush();
    }
  };
  visit(body);
  flush();
  return out.join('\n\n');
};

const fromHtml = (bytes: Uint8Array): Extracted => {
  // The encoding as a browser finds it: a byte-order mark, then the page's own declaration; without one, UTF-8 if it
  // reads as UTF-8, else windows-1252.
  const encoding = htmlEncodingSniffer(bytes, {
    defaultEncoding: isUtf8(bytes) ? 'UTF-8' : 'windows-1252',
  });
  // jsdom runs no script and loads nothing.
  const page = new JSDOM(Buffer.from(bytes), { contentType: `text/html; charset=${encoding}` });
  try {
    const { document } = page.window;
    // Read before Readability, which rewrites the document it's given.
    const title =
      meta(document, 'meta[property="og:title"]') ??
      meta(document, 'meta[name="twitter:title"]') ??
      oneLine(document.title);
    const siteName = meta(document, 'meta[property="og:site_name"]');
    const publishedAt =
      meta(document, 'meta[property="article:published_time"]') ??
      meta(document, 'meta[itemprop="datePublished"]') ??
      meta(document, 'meta[name="date"]') ??
      oneLine(document.querySelector('time[datetime]')?.getAttribute('datetime'));

    const article = new Readability(document).parse();
    let text: string | null = null;
    if (article?.content) {
      const readable = new JSDOM(`<!doctype html><html><body>${article.content}</body></html>`);
      try {
        text = capped(paragraphs(readable.window.document.body));
      } finally {
        readable.window.close();
      }
    }
    return {
      title: title ?? oneLine(article?.title),
      siteName: siteName ?? oneLine(article?.siteName),
      publishedAt: publishedAt ?? oneLine(article?.publishedTime),
      text,
    };
  } finally {
    page.window.close();
  }
};

const fromPdf = async (bytes: Uint8Array): Promise<Extracted> => {
  const task = getDocument({
    // A copy: PDF.js may detach the buffer it is given.
    data: new Uint8Array(bytes),
    // Nothing a document asks for beyond its own text: no forms engine, fonts, fetches or streaming.
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  const document = await task.promise;
  try {
    const { info } = (await document.getMetadata()) as { info?: { Title?: unknown } };
    const pages: string[] = [];
    let length = 0;
    // Pages until the text is long enough to fill the limit: the rest would be cut anyway.
    for (let number = 1; number <= document.numPages && length < PAGE_TEXT_MAX; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) {
          text += item.str + (item.hasEOL ? '\n' : '');
        }
      }
      page.cleanup();
      pages.push(text);
      length += text.length;
    }
    return {
      title: typeof info?.Title === 'string' ? oneLine(info.Title) : null,
      siteName: null,
      publishedAt: null,
      text: capped(pages.join('\n\n')),
    };
  } finally {
    await task.destroy();
  }
};

/** Plain text as written: UTF-8 if it reads as UTF-8, else windows-1252. */
const fromText = (bytes: Uint8Array): Extracted => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return { ...NOTHING, text: capped(text) };
};

/** What a page of this type yields: its metadata and text, or nothing for a type there's no text to read in. */
export const extract = async (
  contentType: string | undefined,
  bytes: Uint8Array,
): Promise<Extracted> => {
  switch (contentType) {
    case 'text/html':
      return fromHtml(bytes);
    case 'application/pdf':
      return fromPdf(bytes);
    case 'text/plain':
      return fromText(bytes);
    default:
      return NOTHING;
  }
};
