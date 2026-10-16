import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { type Lang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang } from '@/params';
import { STRINGS } from '@/strings';

export type TopicsProps = { params: Promise<{ lang: string }> };

/** The page's language, if the path's word is that language's (`/temas`, `/en/topics`). */
export const readTopics = async (word: string, params: TopicsProps['params']): Promise<Lang> => {
  const lang = await pageLang(params);
  if (PATH_WORDS[lang].topics !== word) {
    notFound();
  }
  return lang;
};

export const topicsMetadata = async (word: string, { params }: TopicsProps): Promise<Metadata> => {
  const lang = await readTopics(word, params);
  return {
    title: STRINGS[lang].topics,
    alternates: alternates(lang, paths.topics(lang), {
      es: paths.topics('es'),
      en: paths.topics('en'),
    }),
  };
};
