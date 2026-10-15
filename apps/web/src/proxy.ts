import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy, gonePage } from './security';
import { site } from './site';

/**
 * Every request but build assets: unpublished posts answer 410 (AC-7), which a Next.js page can't; everything else
 * gets the Content Security Policy. The unpublished slugs come from the API, kept for at most 60 s like every read
 * (R-WEB-6); if the API can't be reached, the last list stands.
 */

const SLUG = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const TTL_MS = 60_000;

let unpublished: { at: number; slugs: ReadonlySet<string> } = { at: 0, slugs: new Set() };

const unpublishedSlugs = async (apiUrl: string): Promise<ReadonlySet<string>> => {
  if (Date.now() - unpublished.at < TTL_MS) {
    return unpublished.slugs;
  }
  try {
    const response = await fetch(`${apiUrl}/public/unpublished`, { cache: 'no-store' });
    if (response.ok) {
      unpublished = { at: Date.now(), slugs: new Set((await response.json()) as string[]) };
    }
  } catch {
    // The API is away: keep the list we have, and try again on the next request.
  }
  return unpublished.slugs;
};

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
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
