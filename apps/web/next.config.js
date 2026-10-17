import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));

/**
 * Headers on every response, as aiontheballot's site sets them. The Content Security Policy is the proxy's (proxy.ts),
 * since it names the analytics host, which is configuration read at run time.
 */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace dependencies from the monorepo root so the standalone output includes workspace packages.
  outputFileTracingRoot: join(appDir, '../..'),
  poweredByHeader: false,
  // The images are the API's own re-encodings, already sized (R-WEB-15): no optimizer.
  images: { unoptimized: true },
  // Metadata in <head> for every client, not streamed into the body: crawlers Next doesn't recognise read only the head.
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
  // Error tracking's SDK (instrumentation.ts) loads from node_modules at run time, not bundled.
  serverExternalPackages: ['@sentry/node'],
  // The release that error reports are tagged with: a build fact, so it is inlined.
  env: { APP_RELEASE: `web@${version}` },
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  // Spanish is at the root (D10, AC-11): a reader's address with its prefix goes to the same one without it, query and
  // all. Not the proxy's own rewrite to a Spanish page's `/es…` address (proxy.ts), which Next fetches as a request of
  // its own when the server's host is an IP address; it carries the public path in the proxy's header
  // (PATHNAME_HEADER, src/i18n.ts).
  redirects: async () => {
    const missing = [{ type: 'header', key: 'x-site-pathname' }];
    return [
      { source: '/es', destination: '/', statusCode: 301, missing },
      { source: '/es/:path*', destination: '/:path*', statusCode: 301, missing },
    ];
  },
};

export default nextConfig;
