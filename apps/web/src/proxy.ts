import { type NextRequest, NextResponse } from 'next/server';

import type { Unpublished } from './api';
import type { Lang } from './i18n';

import { missingPage, PATH_WORDS, PATHNAME_HEADER, route } from './i18n';
import { contentSecurityPolicy, gonePage } from './security';
import { site } from './site';

/**
 * Every request but build assets (D10, AC-11). Spanish is at the root, served from the Spanish pages under `/es` (a
 * reader's `/es…` goes to the same address without the prefix: next.config.js); English is under `/en`. An unpublished
 * post answers 410 (AC-7), which a Next.js page can't; every page gets the Content Security Policy. The unpublished
 * posts come from the API, kept for at most 60 s (R-WEB-6); if the API can't be reached, the last list stands and it's
 * asked again 10 s later.
 *
 * A missing address answers 404 with the not-found page of its language, its text in the page itself: an address that
 * is no page's shape, a post's that the API doesn't have, a tag no published post carries, an entity none names (or
 * the bot hid, R-CAP-12). A page's own notFound()
 * would answer 404 too, but Next draws that page in the browser only. If the API can't say, the page decides.
 */

const TTL_MS = 60_000;
/** After a failed read: soon enough to notice the API is back, rare enough not to wait on it every request. */
const RETRY_MS = 10_000;
/** Longer than an in-cluster read ever takes; a request never waits on a hung API for more. */
const TIMEOUT_MS = 2000;

let unpublished: { next: number; posts: ReadonlySet<string> } = { next: 0, posts: new Set() };

const unpublishedPosts = async (apiUrl: string): Promise<ReadonlySet<string>> => {
  if (Date.now() < unpublished.next) {
    return unpublished.posts;
  }
  // Whatever happens, the next request doesn't ask again before RETRY_MS.
  unpublished = { ...unpublished, next: Date.now() + RETRY_MS };
  try {
    const response = await fetch(`${apiUrl}/public/unpublished`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      const posts = (await response.json()) as Unpublished[];
      unpublished = {
        next: Date.now() + TTL_MS,
        posts: new Set(posts.map((post) => `${post.lang}/${post.slug}`)),
      };
    }
  } catch {
    // The API is away or slow: keep the list we have.
  }
  return unpublished.posts;
};

/** Checks under way: readers asking about the same post at once share one request, never an older answer. */
const checking = new Map<string, Promise<boolean | 'gone' | undefined>>();

/**
 * Whether the API has a post (true), had it (`gone`), never had it (false), or can't say (undefined). Asked on every
 * post page, never remembered, so a takedown or an unpublished post answers 410 at once (R-CAP-11, AC-7).
 */
const postExists = (
  apiUrl: string,
  post: { lang: Lang; slug: string },
): Promise<boolean | 'gone' | undefined> => {
  const key = `${post.lang}/${post.slug}`;
  const pending = checking.get(key);
  if (pending) {
    return pending;
  }
  const check = askPostExists(apiUrl, post).finally(() => checking.delete(key));
  checking.set(key, check);
  return check;
};

const askPostExists = async (
  apiUrl: string,
  { lang, slug }: { lang: Lang; slug: string },
): Promise<boolean | 'gone' | undefined> => {
  try {
    const response = await fetch(`${apiUrl}/public/posts/${lang}/${slug}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 410) {
      return 'gone';
    }
    return response.ok ? true : response.status === 404 ? false : undefined;
  } catch {
    return undefined;
  }
};

/** Whether a published post in the language carries the tag, or undefined if the API can't say. */
const tagExists = async (apiUrl: string, lang: Lang, tag: string): Promise<boolean | undefined> => {
  try {
    const response = await fetch(`${apiUrl}/public/tags?lang=${lang}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return undefined;
    }
    return ((await response.json()) as { tag: string }[]).some((row) => row.tag === tag);
  } catch {
    return undefined;
  }
};

/**
 * Whether a published post in the language names the entity, and the bot hasn't hid it (R-WEB-20, R-CAP-12), or
 * undefined if the API can't say. Asked on every entity's page, never remembered, so a hidden one answers 404 at once.
 */
const entityExists = async (
  apiUrl: string,
  lang: Lang,
  id: string,
): Promise<boolean | undefined> => {
  try {
    const response = await fetch(`${apiUrl}/public/entities/${id}?lang=${lang}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? true : response.status === 404 ? false : undefined;
  } catch {
    return undefined;
  }
};

/** The proxy's own page, which loads nothing: the site's policy, without analytics. */
const html = (body: string, status: number): NextResponse =>
  new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': contentSecurityPolicy(undefined),
    },
  });

/** Every page's policy, with the analytics host when it's configured. */
const withPolicy = (
  response: NextResponse,
  analyticsScriptUrl: string | undefined,
): NextResponse => {
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(analyticsScriptUrl, process.env.NODE_ENV === 'development'),
  );
  return response;
};

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;
  const target = route(pathname);
  // The site's own files never wait on the API, the kubelet's probe among them: the site is up if Next is.
  if (target.kind === 'file') {
    return NextResponse.next();
  }
  const config = site();
  if (target.kind === 'internal') {
    // A second run, on the address this proxy rewrote a Spanish page to: its request already says the public path.
    return withPolicy(NextResponse.next(), config.analytics?.scriptUrl);
  }
  if (
    target.post &&
    (await unpublishedPosts(config.apiUrl)).has(`${target.post.lang}/${target.post.slug}`)
  ) {
    return html(gonePage(target.post.lang, config.name[target.post.lang]), 410);
  }
  // The layout's header links to the same page in the other language; a layout isn't told the path, so it's passed on:
  // the public one, which a Spanish page's internal path isn't. Set here for every page, whatever a client sent under
  // the same name.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname);
  const init = { request: { headers } };
  // A post's address, unless it's one of the language's own pages: the topics, the search (R-WEB-18), the entities' index
  // (R-WEB-20), and the about page (a page of its own, whatever the API has).
  const words = PATH_WORDS[target.lang];
  const post =
    target.post &&
    target.post.slug !== words.topics &&
    target.post.slug !== words.about &&
    target.post.slug !== words.search &&
    target.post.slug !== words.who
      ? target.post
      : undefined;
  const exists = !target.known
    ? false
    : post
      ? await postExists(config.apiUrl, post)
      : target.tag !== undefined
        ? await tagExists(config.apiUrl, target.lang, target.tag)
        : target.entity !== undefined
          ? await entityExists(config.apiUrl, target.lang, target.entity)
          : true;
  if (exists === 'gone') {
    return html(gonePage(target.lang, config.name[target.lang]), 410);
  }
  if (exists === false) {
    const missing = request.nextUrl.clone();
    missing.pathname = missingPage(target.lang);
    missing.search = '';
    return withPolicy(
      NextResponse.rewrite(missing, { ...init, status: 404 }),
      config.analytics?.scriptUrl,
    );
  }
  if (target.internal === pathname) {
    return withPolicy(NextResponse.next(init), config.analytics?.scriptUrl);
  }
  const internal = request.nextUrl.clone();
  internal.pathname = target.internal;
  return withPolicy(NextResponse.rewrite(internal, init), config.analytics?.scriptUrl);
};

export const config = {
  matcher: ['/((?!_next/static/).*)'],
};
