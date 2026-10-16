import { css } from '@styled-system/css';
import Link from 'next/link';
import { connection } from 'next/server';

import { tagCounts } from '@/api';
import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { container, pageTitle, pillRow } from '@/styles';
import { tagLabel } from '@/tags';

import { readTopics, type TopicsProps } from './topics-route';

const topic = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  minHeight: '44px',
  paddingX: '4',
  borderRadius: 'full',
  bg: 'accentSoft',
  color: 'accent',
  fontWeight: '600',
  _hover: { textDecoration: 'none', bg: 'card' },
});
const count = css({ color: 'body', fontVariantNumeric: 'tabular-nums' });

/** Every tag in one language with how many posts it has. */
export const TopicsView = async ({ word, params }: TopicsProps & { word: string }) => {
  await connection();
  const lang = await readTopics(word, params);
  const t = STRINGS[lang];
  const tags = await tagCounts(lang);
  return (
    <div className={container}>
      <h1 className={pageTitle}>{t.topics}</h1>
      {tags.length === 0 ? (
        <p>{t.noTopics}</p>
      ) : (
        <ul className={`${pillRow} ${css({ gap: '3' })}`}>
          {tags.map(({ tag, posts }) => (
            <li key={tag}>
              <Link href={paths.tag(lang, tag)} className={topic}>
                {tagLabel(lang, tag)} <span className={count}>{posts}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
