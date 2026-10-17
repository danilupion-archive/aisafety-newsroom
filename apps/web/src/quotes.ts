/** A quotation from someone's post (R-WEB-17), as the posts API gives it. */
export interface Quote {
  text: string;
  author: string;
  handle?: string;
  url: string;
  date: string;
  translation?: string;
}

const PLATFORMS: Record<string, string> = {
  'x.com': 'X',
  'twitter.com': 'X',
  'bsky.app': 'Bluesky',
  'linkedin.com': 'LinkedIn',
  'threads.net': 'Threads',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
};

/** A Mastodon post's path on any of its servers: /@user/<id>. */
const MASTODON_POST = /^\/@[\w.-]+\/\d+\/?$/;

/**
 * Where a quotation was posted, read from its address (D21: the platform is never stored): a known platform's name, a
 * Mastodon server's posts as Mastodon, and anything else as its host.
 */
export const platformOf = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.replace(/^(www|mobile|m)\./, '');
  return PLATFORMS[host] ?? (MASTODON_POST.test(parsed.pathname) ? 'Mastodon' : host);
};
