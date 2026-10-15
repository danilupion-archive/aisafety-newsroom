import { xml } from './feed';

/**
 * The site's Content Security Policy, as aiontheballot's public site sets it: scripts may be inline (Next writes the
 * page's data into inline scripts), and nothing loads from another host but Plausible's script and its events, when
 * configured (R-WEB-7). No frame may hold a page.
 */
export const contentSecurityPolicy = (
  analyticsScriptUrl: string | undefined,
  development = false,
): string => {
  const analytics = analyticsScriptUrl ? ` ${new URL(analyticsScriptUrl).origin}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}${analytics}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${analytics}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
};

/** The page an unpublished post's address answers with, status 410 (AC-7): plain HTML, no layout, no script. */
export const gonePage = (siteName: string): string =>
  [
    '<!doctype html>',
    '<html lang="es">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="robots" content="noindex"><title>Publicación retirada · ${xml(siteName)}</title></head>`,
    '<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem">',
    '<h1>Esta publicación se ha retirado</h1>',
    `<p><a href="/">Volver a ${xml(siteName)}</a></p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
