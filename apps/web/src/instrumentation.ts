import type { Instrumentation } from 'next';

/**
 * Error tracking for the site's server (SPEC §15, R-WEB-7): errors go to GlitchTip's in-cluster Service, scrubbed by
 * the shared privacy options, errors only. Nothing runs in the browser. Off when no DSN is configured (SENTRY_DSN).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  const { readDsn } = await import('@aisafety-newsroom/observability/dsn');
  const dsn = readDsn(process.env);
  if (!dsn) {
    return;
  }
  const [{ init }, { privacyOptions }] = await Promise.all([
    import('@sentry/node'),
    import('@aisafety-newsroom/observability/privacy'),
  ]);
  init({ ...privacyOptions, dsn: dsn.value, release: process.env.APP_RELEASE });
}

/** Every error a request hits on the server: reported with its route, never its query string. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) {
    return;
  }
  const [{ captureException }, { stripQuery }] = await Promise.all([
    import('@sentry/node'),
    import('@aisafety-newsroom/observability/privacy'),
  ]);
  captureException(error, {
    extra: { path: stripQuery(request.path), method: request.method, route: context.routePath },
  });
};
