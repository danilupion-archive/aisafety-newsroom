import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isLang, type Lang, paths } from './i18n';
import { site } from './site';

/** A page's query, as Next passes it. */
export type Query = Record<string, string | string[] | undefined>;

/**
 * The language of the page being rendered, from its first segment. The proxy answers anything else with a 404 before
 * it gets here; this only keeps the type honest.
 */
export const pageLang = async (params: Promise<{ lang: string }>): Promise<Lang> => {
  const { lang } = await params;
  if (!isLang(lang)) {
    notFound();
  }
  return lang;
};

/**
 * A page's alternates: its canonical address, the same page in each language that has it (hreflang), and the feed of
 * its own language, which a page's alternates would otherwise drop (Next merges metadata one key deep).
 */
export const alternates = (
  lang: Lang,
  canonical: string,
  languages: Partial<Record<Lang | 'x-default', string>> = {},
): Metadata['alternates'] => ({
  canonical,
  languages,
  types: { 'application/atom+xml': [{ url: paths.feed(lang), title: site().name[lang] }] },
});
