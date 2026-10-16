import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { type Lang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang, type Query } from '@/params';
import { STRINGS } from '@/strings';
import { TAG, tagLabel } from '@/tags';

export type TagProps = {
  params: Promise<{ lang: string; tag: string }>;
  searchParams: Promise<Query>;
};

/** The page's language and tag, if the path's word is that language's (`/es/etiqueta/…`, `/en/tag/…`). */
export const readTag = async (
  word: string,
  params: TagProps['params'],
): Promise<{ lang: Lang; tag: string }> => {
  const lang = await pageLang(params);
  const { tag } = await params;
  if (PATH_WORDS[lang].tag !== word || !TAG.test(tag)) {
    notFound();
  }
  return { lang, tag };
};

export const tagMetadata = async (word: string, { params }: TagProps): Promise<Metadata> => {
  const { lang, tag } = await readTag(word, params);
  return {
    title: STRINGS[lang].topic(tagLabel(lang, tag)),
    alternates: alternates(lang, paths.tag(lang, tag)),
  };
};
