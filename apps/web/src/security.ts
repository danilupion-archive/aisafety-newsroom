import type { Lang } from './i18n';

import { xml } from './feed';
import { paths } from './i18n';
import { STRINGS } from './strings';
import { PLAYER_ORIGIN } from './video';

/**
 * The site's Content Security Policy, as aiontheballot's public site sets it: scripts may be inline (Next writes the
 * page's data into inline scripts), and nothing loads from another host but Plausible's script and its events, when
 * configured (R-WEB-7), and YouTube's privacy-enhanced player in a frame, which a page adds only once a reader pressed
 * play (R-WEB-12). No frame may hold a page.
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
    `frame-src ${PLAYER_ORIGIN}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
};

/** A page the proxy answers with itself: plain HTML, no layout, no script, kept out of search engines. */
const plainPage = (lang: Lang, title: string, body: readonly string[]): string =>
  [
    '<!doctype html>',
    `<html lang="${lang}">`,
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="robots" content="noindex"><title>${xml(title)}</title></head>`,
    // The site's night colours, inline: these pages load nothing, not even the site's font.
    '<style>html{color-scheme:dark;background:#0F172A}body{font-family:system-ui,sans-serif;color:#F1F5F9;' +
      'max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.6}h1{font-size:2rem;line-height:1.15}' +
      'a{color:#7FFFD4}</style>',
    '<body>',
    ...body,
    '</body>',
    '</html>',
    '',
  ].join('\n');

/** The page an unpublished post's address answers with, status 410 (AC-7), in the post's language. */
export const gonePage = (lang: Lang, siteName: string): string => {
  const { gone } = STRINGS[lang];
  return plainPage(lang, `${gone.title} · ${siteName}`, [
    `<h1>${xml(gone.heading)}</h1>`,
    `<p><a href="${paths.home(lang)}">${xml(gone.back(siteName))}</a></p>`,
  ]);
};
