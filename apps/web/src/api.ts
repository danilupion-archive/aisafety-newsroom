import { cache } from 'react';

import type { Lang } from './i18n';
import type { Cursor, Order } from './paging';

import { type Answer, createReadCache } from './read-cache';
import { site } from './site';

/** A source as the site lists it (R-WEB-1), with its outlet's preview image when the switches show it (R-WEB-16). */
export interface Source {
  title: string;
  url: string;
  accessed: string;
  preview?: { sha256: string; credit: string };
}

/** A post's lead image (R-WEB-15), its size included, when the switches show it; null otherwise. */
export interface PostImage {
  sha256: string;
  alt: string;
  credit: string;
  licence: string;
  source_url: string;
  width: number;
  height: number;
}

export interface PostSummary {
  lang: Lang;
  slug: string;
  type: 'breve' | 'article' | 'page';
  title: string;
  summary: string;
  tags: string[];
  published_at: string;
  updated_at: string;
  /** How many sources it has, for the timeline's "2 fuentes"; absent from an API older than the count. */
  source_count?: number;
  /** The day its story happened, `YYYY-MM-DD` (R-WEB-13); absent from an API older than news dates. */
  news_date?: string | null;
  /** Its lead image, for the card's thumbnail; absent from an API older than images. */
  image?: PostImage | null;
  /** Its first source preview the switches show, for a card without a lead image (R-WEB-16); absent from older APIs. */
  preview?: { sha256: string; credit: string; source_url?: string } | null;
  /** Who wrote it when a person did (R-WEB-3, D19); absent or null, AI wrote it. Absent from older APIs. */
  author?: string | null;
  /** A translation's original writer, when a person wrote the original (D19). */
  original_author?: string | null;
}

/** Another published version of a post's story, in the other language (R-WEB-10). */
export interface Translation {
  lang: Lang;
  slug: string;
  title: string;
}

export interface Post extends PostSummary {
  body_md: string;
  sources: Source[];
  translations: Translation[];
}

export interface TagCount {
  tag: string;
  posts: number;
}

/** An unpublished post's address, for the proxy's 410 (AC-7). */
export interface Unpublished {
  lang: Lang;
  slug: string;
}

/** Well inside the gateway's 15 s: a stuck API makes an error page, never a request left hanging. */
const READ_TIMEOUT_MS = 8000;

/**
 * The site's memory of the API's answers (R-WEB-6): 30 s each, never served older, and identical reads at once share
 * one request. Not Next's fetch cache, which revalidates in the background and so serves an answer past its time to
 * the first visitor after a quiet spell. A takedown or an unpublished post still shows at once: the proxy asks the API
 * about each post page itself (src/proxy.ts).
 */
const remembered = createReadCache({ ttlMs: 30_000, maxEntries: 500 });

const read = (path: string): Promise<Answer> =>
  remembered(path, async () => {
    const response = await fetch(`${site().apiUrl}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    return { status: response.status, body: await response.text() };
  });

const json = async <T>(path: string): Promise<T> => {
  const answer = await read(path);
  if (answer.status < 200 || answer.status >= 300) {
    throw new Error(`The API answered ${answer.status} for ${path.split('?')[0]}`);
  }
  return JSON.parse(answer.body) as T;
};

export const latestPosts = (
  lang: Lang,
  options: { tag?: string; after?: Cursor; limit?: number; order?: Order } = {},
) => {
  const query = new URLSearchParams({ lang });
  if (options.tag !== undefined) {
    query.set('tag', options.tag);
  }
  if (options.order === 'news') {
    query.set('order', 'news');
  }
  if (options.after !== undefined) {
    query.set('before', options.after.before);
    if (options.after.beforeSlug !== undefined) {
      query.set('before_slug', options.after.beforeSlug);
    }
    if (options.order === 'news' && options.after.beforeDate !== undefined) {
      query.set('before_date', options.after.beforeDate);
    }
  }
  query.set('limit', String(options.limit ?? 20));
  return json<PostSummary[]>(`/public/posts?${query.toString()}`);
};

/** The API's largest page. */
const MAX_PAGE = 500;

/** Every published post in one language, page by page: for the sitemap. */
export const allPosts = async (lang: Lang): Promise<PostSummary[]> => {
  const posts: PostSummary[] = [];
  for (;;) {
    const last = posts.at(-1);
    const page = await latestPosts(lang, {
      limit: MAX_PAGE,
      after: last ? { before: last.published_at, beforeSlug: last.slug } : undefined,
    });
    posts.push(...page);
    if (page.length < MAX_PAGE) {
      return posts;
    }
  }
};

/**
 * One post or page; 'gone' once unpublished, undefined if it never was. Asked once per request: the layout (for the
 * header's link to the other language) and the page share the answer.
 */
export const getPost = cache(
  async (lang: Lang, slug: string): Promise<Post | 'gone' | undefined> => {
    const answer = await read(`/public/posts/${lang}/${encodeURIComponent(slug)}`);
    // An address the API refuses (400) is no post either: a reader's typo is a 404, never a 500.
    if (answer.status === 404 || answer.status === 400) {
      return undefined;
    }
    if (answer.status === 410) {
      return 'gone';
    }
    if (answer.status < 200 || answer.status >= 300) {
      throw new Error(`The API answered ${answer.status} for a post`);
    }
    return JSON.parse(answer.body) as Post;
  },
);

export const tagCounts = (lang: Lang) => json<TagCount[]>(`/public/tags?lang=${lang}`);
