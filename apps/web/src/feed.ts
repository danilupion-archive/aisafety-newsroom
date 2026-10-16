import type { PostSummary } from './api';
import type { Lang } from './i18n';

import { paths } from './i18n';
import { STRINGS } from './strings';

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
  authorUrl?: string | undefined;
}

/**
 * One language's Atom feed of its latest posts (SPEC §13 pages), their summaries as the entries' text. Each language
 * has its own: a reader subscribes to the one they read. Readers show an entry without the site's footer, so each one
 * says itself that its text is AI-written and who picked and checked it (R-WEB-3).
 */
export const atomFeed = (lang: Lang, site: FeedSite, posts: readonly PostSummary[]): string => {
  const updated = posts.reduce(
    (latest, post) => (post.updated_at > latest ? post.updated_at : latest),
    '',
  );
  const home = `${site.url}${paths.home(lang)}`;
  const credit = STRINGS[lang].feedCredit(site.author);
  const entries = posts.map((post) => {
    const link = `${site.url}${paths.post(lang, post.slug)}`;
    return [
      '  <entry>',
      `    <id>${xml(link)}</id>`,
      `    <title>${xml(post.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${xml(link)}"/>`,
      `    <published>${xml(new Date(post.published_at).toISOString())}</published>`,
      `    <updated>${xml(new Date(post.updated_at).toISOString())}</updated>`,
      ...post.tags.map((tag) => `    <category term="${xml(tag)}"/>`),
      `    <summary>${xml(post.summary === '' ? credit : `${post.summary}\n\n${credit}`)}</summary>`,
      '  </entry>',
    ]
      .filter((line) => line !== '')
      .join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">`,
    `  <id>${xml(home)}</id>`,
    `  <title>${xml(site.name)}</title>`,
    `  <link rel="alternate" type="text/html" href="${xml(home)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(`${site.url}${paths.feed(lang)}`)}"/>`,
    `  <rights>${xml(`${STRINGS[lang].licence.name} · ${STRINGS[lang].licence.url}`)}</rights>`,
    `  <author><name>${xml(site.author)}</name>${site.authorUrl === undefined ? '' : `<uri>${xml(site.authorUrl)}</uri>`}</author>`,
    `  <updated>${xml(new Date(updated === '' ? 0 : updated).toISOString())}</updated>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
};
