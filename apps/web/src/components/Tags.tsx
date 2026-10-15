import { css } from '@styled-system/css';
import Link from 'next/link';

import { muted } from '@/styles';
import { tagLabel } from '@/tags';

const list = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3',
  listStyle: 'none',
  padding: '0',
  margin: '0',
});

export const Tags = ({ tags }: { tags: readonly string[] }) =>
  tags.length === 0 ? null : (
    <ul className={`${list} ${muted}`} aria-label="Temas">
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={`/etiqueta/${tag}`}>{tagLabel(tag)}</Link>
        </li>
      ))}
    </ul>
  );
