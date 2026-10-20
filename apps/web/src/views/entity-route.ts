import type { Metadata } from 'next';

import { isEntityId } from '@aisafety-newsroom/domain/entities';
import { notFound } from 'next/navigation';

import { getEntity } from '@/api';
import { type Lang, otherLang, PATH_WORDS, paths } from '@/i18n';
import { alternates, pageLang, type Query } from '@/params';

export type EntityProps = {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<Query>;
};

/** The page's language and entity, if the path's word is that language's (`/quien/…`, `/en/who/…`). */
export const readEntity = async (
  word: string,
  params: EntityProps['params'],
): Promise<{ lang: Lang; id: string }> => {
  const lang = await pageLang(params);
  const { id } = await params;
  if (PATH_WORDS[lang].who !== word || !isEntityId(id)) {
    notFound();
  }
  return { lang, id };
};

/**
 * Its name and description, and its page in the other language where a story there names it too (R-WEB-20). No
 * metadata for a missing one: its page says not found, inside the language's layout.
 */
export const entityMetadata = async (word: string, { params }: EntityProps): Promise<Metadata> => {
  const { lang, id } = await readEntity(word, params);
  const entity = await getEntity(lang, id);
  if (!entity) {
    return {};
  }
  const other = otherLang(lang);
  // Only a link: if the API can't say, the page goes without it.
  const there = await getEntity(other, id).catch(() => undefined);
  const self = paths.entity(lang, id);
  return {
    title: entity.name,
    description: entity.description,
    alternates: alternates(
      lang,
      self,
      there ? { [lang]: self, [other]: paths.entity(other, id) } : {},
    ),
  };
};
