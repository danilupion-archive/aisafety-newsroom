import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy, gonePage } from './security';
import { site } from './site';

/**
 * Every request but build assets: unpublished posts answer 410 (AC-7), which a Next.js page can't; everything else
 * gets the Content Security Policy. The unpublished slugs come from the API, kept for at most 60 s (R-WEB-6); if the
 * API can't be reached, the last list stands and it's asked again 10 s later.
 */

const SLUG = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const TTL_MS = 60_000;
/** After a failed read: soon enough to notice the API is back, rare enough not to wait on it every request. */
const RETRY_MS = 10_000;
/** Longer than an in-cluster read ever takes; a request never waits on a hung API for more. */
const TIMEOUT_MS = 2000;

let unpublished: { next: number; slugs: ReadonlySet<string> } = { next: 0, slugs: new Set() };

const unpublishedSlugs = async (apiUrl: string): Promise<ReadonlySet<string>> => {
  if (Date.now() < unpublished.next) {
    return unpublished.slugs;
  }
  // Whatever happens, the next request doesn't ask again before RETRY_MS.
  unpublished = { ...unpublished, next: Date.now() + RETRY_MS };
  try {
    const response = await fetch(`${apiUrl}/public/unpublished`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      unpublished = {
        next: Date.now() + TTL_MS,
        slugs: new Set((await response.json()) as string[]),
      };
    }
  } catch {
    // The API is away or slow: keep the list we have.
  }
  return unpublished.slugs;
};

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  // The kubelet's probe never waits on the API: the site is up if Next is.
  if (request.nextUrl.pathname === '/healthz') {
    return NextResponse.next();
  }
  const config = site();
  const slug = SLUG.exec(request.nextUrl.pathname)?.[1];
  if (slug !== undefined && (await unpublishedSlugs(config.apiUrl)).has(slug)) {
    return new NextResponse(gonePage(config.name), {
      status: 410,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
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
