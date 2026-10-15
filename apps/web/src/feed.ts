import type { PostSummary } from './api';

/** Text as XML can carry it: the five characters XML gives meaning, escaped. */
export const xml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export interface FeedSite {
  url: string;
  name: string;
  author: string;
}

/** The Atom feed of the latest posts (SPEC §13 pages: an RSS/Atom feed), their summaries as the entries' text. */
export const atomFeed = (site: FeedSite, posts: readonly PostSummary[]): string => {
  const updated = posts.reduce(
    (latest, post) => (post.updated_at > latest ? post.updated_at : latest),
    '',
  );
  const entries = posts.map((post) => {
    const link = `${site.url}/${post.slug}`;
    return [
      '  <entry>',
      `    <id>${xml(link)}</id>`,
      `    <title>${xml(post.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${xml(link)}"/>`,
      `    <published>${xml(new Date(post.published_at).toISOString())}</published>`,
      `    <updated>${xml(new Date(post.updated_at).toISOString())}</updated>`,
      ...post.tags.map((tag) => `    <category term="${xml(tag)}"/>`),
      post.summary === '' ? '' : `    <summary>${xml(post.summary)}</summary>`,
      '  </entry>',
    ]
      .filter((line) => line !== '')
      .join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">',
    `  <id>${xml(`${site.url}/`)}</id>`,
    `  <title>${xml(site.name)}</title>`,
    `  <link rel="alternate" type="text/html" href="${xml(`${site.url}/`)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(`${site.url}/feed.xml`)}"/>`,
    `  <author><name>${xml(site.author)}</name></author>`,
    `  <updated>${xml(new Date(updated === '' ? 0 : updated).toISOString())}</updated>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
};
