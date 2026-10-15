import { site } from './site';

/** A source as the site lists it (R-WEB-1). */
export interface Source {
  title: string;
  url: string;
  accessed: string;
}

export interface PostSummary {
  slug: string;
  type: 'breve' | 'article' | 'page';
  title: string;
  summary: string;
  tags: string[];
  published_at: string;
  updated_at: string;
}

export interface Post extends PostSummary {
  body_md: string;
  sources: Source[];
}

export interface TagCount {
  tag: string;
  posts: number;
}

/** Each answer is kept for at most 60 s (R-WEB-6), so a post appears or leaves within a minute of `/post` (AC-7). */
const REVALIDATE_SECONDS = 60;

const read = async (path: string): Promise<Response> =>
  fetch(`${site().apiUrl}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });

const json = async <T>(path: string): Promise<T> => {
  const response = await read(path);
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path.split('?')[0]}`);
  }
  return (await response.json()) as T;
};

export const latestPosts = (options: { tag?: string; before?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (options.tag !== undefined) {
    query.set('tag', options.tag);
  }
  if (options.before !== undefined) {
    query.set('before', options.before);
  }
  query.set('limit', String(options.limit ?? 20));
  return json<PostSummary[]>(`/public/posts?${query.toString()}`);
};

/** One post or page; 'gone' once unpublished, undefined if it never was. */
export const getPost = async (slug: string): Promise<Post | 'gone' | undefined> => {
  const response = await read(`/public/posts/${encodeURIComponent(slug)}`);
  if (response.status === 404) {
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

export const tagCounts = () => json<TagCount[]>('/public/tags');
