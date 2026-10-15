import type { Dsn } from '@aisafety-newsroom/observability/dsn';

import { privacyOptions } from '@aisafety-newsroom/observability/privacy';
import { init, type NodeOptions, onUnhandledRejectionIntegration } from '@sentry/node';
import { readFileSync } from 'node:fs';

/** `api@<version>` or `worker@<version>`, read at runtime so it works from `src` (tests) and `dist` (the image). */
export const readRelease = (component: 'api' | 'worker'): string => {
  const packageJson = new URL('../package.json', import.meta.url);
  const { version } = JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string };
  return `${component}@${version}`;
};

/**
 * Error tracking (SPEC §15), as aiontheballot does it: events go to GlitchTip's in-cluster Service, scrubbed by the
 * shared privacy options, errors only. Off when no DSN is configured (SENTRY_DSN), as in development and CI.
 */
export const initErrorTracking = (
  dsn: Dsn | undefined,
  component: 'api' | 'worker',
  overrides: Partial<NodeOptions> = {},
): void => {
  init({
    ...privacyOptions,
    dsn: dsn?.value,
    enabled: dsn !== undefined,
    release: readRelease(component),
    // The SDK's default ("warn") keeps a process alive after an unhandled rejection, which Node would end; ending it
    // lets Kubernetes restart it in a known state. Reported first, as fatal.
    integrations: [onUnhandledRejectionIntegration({ mode: 'strict' })],
    ...overrides,
  });
};

/**
 * An error by its class only: its name and, for a database error, its SQLSTATE. Never its message, which could quote
 * a value, a page's text or a note.
 */
export const errorClass = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return typeof error;
  }
  const code = 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : '';
  return `${error.name}${code}`;
};
