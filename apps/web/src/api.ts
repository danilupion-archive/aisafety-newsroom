import type { Lang } from './i18n';
import type { Cursor } from './paging';

import { site } from './site';

/** A source as the site lists it (R-WEB-1). */
export interface Source {
  title: string;
  url: string;
  accessed: string;
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

/**
 * Never cached here: reads stay inside the cluster and are cheap, and a cache that revalidates in the background would
 * serve an answer past its 60 s to the first visitor after it (R-WEB-6, AC-7). The feeds' own `max-age=60` is the
 * only wait.
 */
const read = async (path: string): Promise<Response> =>
  fetch(`${site().apiUrl}${path}`, { cache: 'no-store' });

const json = async <T>(path: string): Promise<T> => {
  const response = await read(path);
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path.split('?')[0]}`);
  }
  return (await response.json()) as T;
};

export const latestPosts = (
  lang: Lang,
  options: { tag?: string; after?: Cursor; limit?: number } = {},
) => {
  const query = new URLSearchParams({ lang });
  if (options.tag !== undefined) {
    query.set('tag', options.tag);
  }
  if (options.after !== undefined) {
    query.set('before', options.after.before);
    if (options.after.beforeSlug !== undefined) {
      query.set('before_slug', options.after.beforeSlug);
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

/** One post or page; 'gone' once unpublished, undefined if it never was. */
export const getPost = async (lang: Lang, slug: string): Promise<Post | 'gone' | undefined> => {
  const response = await read(`/public/posts/${lang}/${encodeURIComponent(slug)}`);
  // An address the API refuses (400) is no post either: a reader's typo is a 404, never a 500.
  if (response.status === 404 || response.status === 400) {
    return undefined;
  }
  if (response.status === 410) {
    return 'gone';
  }
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for a post`);
  }
  return (await response.json()) as Post;
};

export const tagCounts = (lang: Lang) => json<TagCount[]>(`/public/tags?lang=${lang}`);
