import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { type Lang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang, type Query } from '@/params';
import { STRINGS } from '@/strings';

export type SearchProps = { params: Promise<{ lang: string }>; searchParams: Promise<Query> };

/** The page's language, if the path's word is that language's (`/buscar`, `/en/search`). */
export const readSearchPage = async (
  word: string,
  params: SearchProps['params'],
): Promise<Lang> => {
  const lang = await pageLang(params);
  if (PATH_WORDS[lang].search !== word) {
    notFound();
  }
  return lang;
};

/** A search page is for readers, never for search engines: its results change and its addresses are endless. */
export const searchMetadata = async (word: string, { params }: SearchProps): Promise<Metadata> => {
  const lang = await readSearchPage(word, params);
  return {
    title: STRINGS[lang].search.name,
    robots: { index: false, follow: true },
    alternates: alternates(lang, paths.search(lang), {
      es: paths.search('es'),
      en: paths.search('en'),
    }),
  };
};
