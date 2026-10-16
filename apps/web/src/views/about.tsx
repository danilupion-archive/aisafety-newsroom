import { renderMarkdown } from '@aisafety-newsroom/domain/markdown';
import { connection } from 'next/server';

import { getPost } from '@/api';
import { Translations } from '@/components/Translations';
import { STRINGS } from '@/strings';
import { pageTitle, prose } from '@/styles';

import { type AboutProps, readAbout } from './about-route';

/**
 * Who writes the site and why (R-WEB-3), in one language: the page whose slug is the language's word for it, pushed
 * from aisafety-media like every text on the site, so none of it is written here.
 */
export const AboutView = async ({ word, params }: AboutProps & { word: string }) => {
  await connection();
  const lang = await readAbout(word, params);
  const page = await getPost(lang, word);
  if (page === undefined || page === 'gone') {
    return (
      <>
        <h1 className={pageTitle}>{STRINGS[lang].about}</h1>
        <p>{STRINGS[lang].aboutPending}</p>
      </>
    );
  }
  return (
    <article>
      <h1 className={pageTitle}>{page.title}</h1>
      <Translations translations={page.translations} />
      <div className={prose} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body_md) }} />
    </article>
  );
};
