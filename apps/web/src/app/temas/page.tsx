import type { Metadata } from 'next';

import Link from 'next/link';
import { connection } from 'next/server';

import { tagCounts } from '@/api';
import { muted, pageTitle } from '@/styles';
import { tagLabel } from '@/tags';

export const metadata: Metadata = { title: 'Temas', alternates: { canonical: '/temas' } };

/** Every tag with how many posts it has. */
const Topics = async () => {
  await connection();
  const tags = await tagCounts();
  return (
    <>
      <h1 className={pageTitle}>Temas</h1>
      {tags.length === 0 ? (
        <p>Todavía no hay temas.</p>
      ) : (
        <ul>
          {tags.map(({ tag, posts }) => (
            <li key={tag}>
              <Link href={`/etiqueta/${tag}`}>{tagLabel(tag)}</Link>{' '}
              <span className={muted}>({posts})</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default Topics;
