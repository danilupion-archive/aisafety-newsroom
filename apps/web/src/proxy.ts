import { type NextRequest, NextResponse } from 'next/server';

import type { Unpublished } from './api';

import { isLang, paths, preferredLang } from './i18n';
import { contentSecurityPolicy, gonePage, notFoundPage } from './security';
import { site } from './site';

/**
 * Every request but build assets. `/` sends the reader to their language (D10); an address outside both languages
 * answers 404; an unpublished post answers 410 (AC-7), which a Next.js page can't; everything else gets the Content
 * Security Policy. The unpublished posts come from the API, kept for at most 60 s (R-WEB-6); if the API can't be
 * reached, the last list stands and it's asked again 10 s later.
 */

/** A post's address: /<lang>/<slug>. */
const POST = /^\/([a-z]{2})\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
/** The site's own files outside the languages. */
const ROOT_FILES = new Set(['/healthz', '/sitemap.xml', '/robots.txt', '/favicon.ico']);
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

/** One of the proxy's own pages, which load nothing: the site's policy, without analytics. */
const html = (body: string, status: number): NextResponse =>
  new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': contentSecurityPolicy(undefined),
    },
  });

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;
  // The kubelet's probe never waits on the API: the site is up if Next is.
  if (pathname === '/healthz') {
    return NextResponse.next();
  }
  const config = site();
  if (pathname === '/') {
    // On the site's own address: behind the gateway the request reaches Next over plain HTTP, and an address built from
    // it could send the reader to http://. The query goes along (a campaign's link, say).
    const home = paths.home(preferredLang(request.headers.get('accept-language')));
    const response = NextResponse.redirect(
      new URL(`${home}${request.nextUrl.search}`, config.url),
      307,
    );
    response.headers.set('Vary', 'Accept-Language');
    response.headers.set('Cache-Control', 'private, no-cache');
    return response;
  }
  const first = pathname.split('/')[1];
  if (!isLang(first) && !ROOT_FILES.has(pathname) && !pathname.startsWith('/_next/')) {
    return html(notFoundPage(config.name), 404);
  }
  const post = POST.exec(pathname);
  if (
    post &&
    isLang(post[1]) &&
    (await unpublishedPosts(config.apiUrl)).has(`${post[1]}/${post[2]}`)
  ) {
    return html(gonePage(post[1], config.name[post[1]]), 410);
  }
  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(config.analytics?.scriptUrl, process.env.NODE_ENV === 'development'),
  );
  return response;
};

export const config = {
  matcher: ['/((?!_next/static/).*)'],
};
