import { type NextRequest, NextResponse } from 'next/server';

import type { Unpublished } from './api';

import { PATHNAME_HEADER, route } from './i18n';
import { contentSecurityPolicy, gonePage } from './security';
import { site } from './site';

/**
 * Every request but build assets (D10, AC-11). Spanish is at the root, served from the Spanish pages under `/es` (a
 * reader's `/es…` goes to the same address without the prefix: next.config.js); English is under `/en`. An unpublished
 * post answers 410 (AC-7), which a Next.js page can't; every page gets the Content Security Policy. The unpublished
 * posts come from the API, kept for at most 60 s (R-WEB-6); if the API can't be reached, the last list stands and it's
 * asked again 10 s later.
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
