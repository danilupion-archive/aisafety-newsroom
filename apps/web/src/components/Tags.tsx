import { css } from '@styled-system/css';
import Link from 'next/link';

import type { Lang } from '@/i18n';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
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

export const Tags = ({ lang, tags }: { lang: Lang; tags: readonly string[] }) =>
  tags.length === 0 ? null : (
    <ul className={`${list} ${muted}`} aria-label={STRINGS[lang].topics}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={paths.tag(lang, tag)}>{tagLabel(lang, tag)}</Link>
        </li>
      ))}
    </ul>
  );
