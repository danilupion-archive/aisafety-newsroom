import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

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
  // The site shows no images (R-WEB-3): no optimizer either.
  images: { unoptimized: true },
  // Metadata in <head> for every client, not streamed into the body: crawlers Next doesn't recognise read only the head.
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
};

export default nextConfig;
