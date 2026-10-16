import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { type Lang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang } from '@/params';
import { STRINGS } from '@/strings';

export type AboutProps = { params: Promise<{ lang: string }> };

/** The page's language, if the path's word is that language's (`/es/sobre`, `/en/about`). */
export const readAbout = async (word: string, params: AboutProps['params']): Promise<Lang> => {
  const lang = await pageLang(params);
  if (PATH_WORDS[lang].about !== word) {
    notFound();
  }
  return lang;
};

export const aboutMetadata = async (word: string, { params }: AboutProps): Promise<Metadata> => {
  const lang = await readAbout(word, params);
  return {
    title: STRINGS[lang].about,
    alternates: alternates(lang, paths.about(lang), {
      es: paths.about('es'),
      en: paths.about('en'),
    }),
  };
};
