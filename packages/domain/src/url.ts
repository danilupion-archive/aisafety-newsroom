/** Query parameters that only track where a click came from (R-CAP-5). `utm_*` is matched by prefix. */
const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'igshid', 'ref']);

/** On x.com, `s` and `t` only say how a post was shared. */
const X_TRACKING_PARAMETERS = new Set(['s', 't']);

/** Hosts that serve the same posts as x.com. */
const X_ALIASES = new Set([
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'www.x.com',
  'mobile.x.com',
]);

/** YouTube's hosts for its videos' pages, and for links to them. */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTU_BE = new Set(['youtu.be', 'www.youtu.be']);

/** Paths that name a video by its id: `/shorts/<id>`, `/live/<id>`, `/embed/<id>`, `/v/<id>`. */
const YOUTUBE_VIDEO_PATH = /^\/(?:shorts|live|embed|v)\/([^/]+)\/?$/;

/** A YouTube video id: 11 characters of letters, digits, `-` and `_`. */
const YOUTUBE_ID = /^[\w-]{11}$/;

/** On YouTube, `si`, `feature` and `pp` only say how a link was shared. */
const YOUTUBE_TRACKING_PARAMETERS = new Set(['si', 'feature', 'pp']);

/**
 * The link with `https://` in front if it has none: Telegram marks "example.com/a" as a link too. A colon followed by
 * a digit is a port ("example.com:8080"), not a scheme.
 */
export const withScheme = (input: string): string => {
  const trimmed = input.trim();
  return /^[a-z][a-z\d+.-]*:(?!\d)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const parse = (input: string): URL | null => {
  const completed = withScheme(input);
  if (!URL.canParse(completed)) {
    return null;
  }
  const url = new URL(completed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  // A host needs a dot ("not a url" parses as a host otherwise); localhost and addresses are left to the fetcher.
  if (!url.hostname.includes('.') && !url.hostname.includes(':')) {
    return null;
  }
  return url;
};

/**
 * The id of the YouTube video a link is to, in any of the forms YouTube writes it (`watch?v=`, `youtu.be/`, `/shorts/`,
 * `/live/`, `/embed/`), or null for any other link.
 */
export const youtubeVideoId = (input: string): string | null => {
  const url = parse(input);
  if (!url) {
    return null;
  }
  let id: string | null | undefined;
  if (YOUTU_BE.has(url.hostname)) {
    id = url.pathname.replace(/^\/|\/$/g, '');
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    id =
      url.pathname.replace(/\/$/, '') === '/watch'
        ? url.searchParams.get('v')
        : YOUTUBE_VIDEO_PATH.exec(url.pathname)?.[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
};

/** A YouTube video's own page, where every form of a link to it leads (R-CAP-5). */
export const youtubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/**
 * The form of a link used to recognise it when it's sent again (R-CAP-5): lowercase scheme and host (the URL parser
 * does both), no fragment, no tracking parameters, twitter.com as x.com, no trailing slash, and every link to a
 * YouTube video as its watch page with nothing but the id, so a start time (`t`) doesn't make another source. Null for
 * anything that isn't an http or https link.
 */
export const normalizeUrl = (input: string): string | null => {
  const url = parse(input);
  if (!url) {
    return null;
  }
  const video = youtubeVideoId(input);
  if (video) {
    return youtubeWatchUrl(video);
  }
  if (X_ALIASES.has(url.hostname)) {
    url.hostname = 'x.com';
  }
  const isX = url.hostname === 'x.com';
  const isYoutube = YOUTUBE_HOSTS.has(url.hostname) || YOUTU_BE.has(url.hostname);
  const isTracking = (name: string): boolean => {
    const lower = name.toLowerCase();
    return (
      lower.startsWith('utm_') ||
      TRACKING_PARAMETERS.has(lower) ||
      (isX && X_TRACKING_PARAMETERS.has(lower)) ||
      (isYoutube && YOUTUBE_TRACKING_PARAMETERS.has(lower))
    );
  };
  // Always re-encoded, so "a%20b" and "a+b" match whether or not something was dropped. This form only recognises a
  // link: the worker fetches the link as sent.
  url.search = new URLSearchParams(
    [...url.searchParams].filter(([name]) => !isTracking(name)),
  ).toString();
  const credentials = url.username
    ? `${url.username}${url.password ? `:${url.password}` : ''}@`
    : '';
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${credentials}${url.host}${path}${url.search}`;
};

/** The host of a link as normalizeUrl sees it, e.g. to match the list of hosts the worker skips (R-FET-3). */
export const hostOf = (input: string): string | null => {
  const normalized = normalizeUrl(input);
  return normalized ? new URL(normalized).hostname : null;
};
