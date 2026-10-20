import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { type Lang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang } from '@/params';
import { STRINGS } from '@/strings';

export type EntitiesProps = { params: Promise<{ lang: string }> };

/** The page's language, if the path's word is that language's (`/quien`, `/en/who`). */
export const readEntities = async (
  word: string,
  params: EntitiesProps['params'],
): Promise<Lang> => {
  const lang = await pageLang(params);
  if (PATH_WORDS[lang].who !== word) {
    notFound();
  }
  return lang;
};

export const entitiesMetadata = async (
  word: string,
  { params }: EntitiesProps,
): Promise<Metadata> => {
  const lang = await readEntities(word, params);
  return {
    title: STRINGS[lang].who,
    description: STRINGS[lang].whoIntro,
    alternates: alternates(lang, paths.entities(lang), {
      es: paths.entities('es'),
      en: paths.entities('en'),
    }),
  };
};
