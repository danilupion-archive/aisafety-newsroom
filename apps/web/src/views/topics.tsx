import Link from 'next/link';
import { connection } from 'next/server';

import { tagCounts } from '@/api';
import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { muted, pageTitle } from '@/styles';
import { tagLabel } from '@/tags';

import { readTopics, type TopicsProps } from './topics-route';

/** Every tag in one language with how many posts it has. */
export const TopicsView = async ({ word, params }: TopicsProps & { word: string }) => {
  await connection();
  const lang = await readTopics(word, params);
  const t = STRINGS[lang];
  const tags = await tagCounts(lang);
  return (
    <>
      <h1 className={pageTitle}>{t.topics}</h1>
      {tags.length === 0 ? (
        <p>{t.noTopics}</p>
      ) : (
        <ul>
          {tags.map(({ tag, posts }) => (
            <li key={tag}>
              <Link href={paths.tag(lang, tag)}>{tagLabel(lang, tag)}</Link>{' '}
              <span className={muted}>({posts})</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
